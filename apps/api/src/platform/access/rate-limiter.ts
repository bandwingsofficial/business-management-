import { InfrastructureError } from '@/common/errors/application-error';

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  public constructor(private readonly now: () => number = Date.now) {}

  public async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision> {
    const current = this.now();
    const existing = this.buckets.get(key);
    const bucket =
      existing === undefined || existing.resetAt <= current
        ? { count: 0, resetAt: current + windowSeconds * 1000 }
        : existing;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    if (bucket.count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
      };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export class FailingRateLimiter implements RateLimiter {
  public async consume(
    _key: string,
    _limit: number,
    _windowSeconds: number,
  ): Promise<RateLimitDecision> {
    throw new InfrastructureError();
  }
}

export interface RateLimitRedis {
  eval(script: string, keyCount: number, key: string, windowSeconds: string): Promise<unknown>;
}

const CONSUME_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return { current, redis.call('TTL', KEYS[1]) }
`;

export function createRateLimiter(redis?: RateLimitRedis): RateLimiter {
  return redis === undefined ? new MemoryRateLimiter() : new RedisRateLimiter(redis);
}

export class RedisRateLimiter implements RateLimiter {
  public constructor(private readonly redis: RateLimitRedis) {}

  public async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision> {
    let result: unknown;
    try {
      result = await this.redis.eval(
        CONSUME_SCRIPT,
        1,
        `softtech:rate:${key}`,
        String(windowSeconds),
      );
    } catch (error) {
      if (error instanceof InfrastructureError) {
        throw error;
      }
      throw new InfrastructureError();
    }

    if (!Array.isArray(result) || result.length < 2) {
      throw new InfrastructureError();
    }
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
      throw new InfrastructureError();
    }
    if (count > limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
