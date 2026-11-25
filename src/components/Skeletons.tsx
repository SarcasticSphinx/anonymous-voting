export function PollSkeleton() {
  return (
    <div className="pt-8 sm:pt-12">
      <div className="skeleton" style={{ height: 24, width: 90 }} />
      <div className="skeleton mt-4" style={{ height: 40, width: "65%" }} />
      <div className="skeleton mt-8" style={{ height: 50 }} />
      <div className="pick-grid mt-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 56 }} />
        ))}
      </div>
    </div>
  );
}
