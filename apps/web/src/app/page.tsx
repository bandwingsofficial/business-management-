import { appMeta } from '@/lib/app-meta';

export default function HomePage() {
  return (
    <main>
      <h1>{appMeta.name}</h1>
      <p>{appMeta.description}</p>
    </main>
  );
}
