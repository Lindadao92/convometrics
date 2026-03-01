export function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-white/[0.05] py-12 first:pt-10 last:border-b-0">
      {children}
    </section>
  );
}
