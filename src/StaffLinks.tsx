import { trainingUrl } from "./staffNavigation";
export function StaffLink({
  route,
  values,
  children,
  className = "text-button",
}: {
  route: string;
  values?: Record<string, string>;
  children: React.ReactNode;
  className?: string;
}) {
  const href = trainingUrl(route, values);
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        e.preventDefault();
        history.pushState(null, "", href);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }}
    >
      {children}
    </a>
  );
}
