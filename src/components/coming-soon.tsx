export function ComingSoon({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-3 text-sm text-neutral-500">{description}</p>
      <p className="mt-6 inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500">
        {phase}에서 구현 예정
      </p>
    </div>
  );
}
