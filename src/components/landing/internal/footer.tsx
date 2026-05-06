import Image from "next/image";

const FOOTER_COLUMNS = [
  {
    title: "제품",
    items: [
      { label: "기능", href: "#features" },
      { label: "가격", href: "#pricing" },
      { label: "사례", href: "#cases" },
    ],
  },
  {
    title: "회사",
    items: [
      { label: "소개", href: "#" },
      { label: "블로그", href: "#" },
      { label: "채용", href: "#" },
    ],
  },
  {
    title: "리소스",
    items: [
      { label: "문서", href: "#" },
      { label: "가이드", href: "#" },
      { label: "변경 사항", href: "#" },
    ],
  },
  {
    title: "법적",
    items: [
      { label: "개인정보", href: "#" },
      { label: "이용약관", href: "#" },
      { label: "쿠키", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-cream-deep/30">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 text-ink">
              <Image src="/Logo.png" alt="FlowSpace" width={32} height={32} />
              <span className="font-serif text-xl font-medium tracking-tight">FlowSpace</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              한국에서 만들어, 한국에서 운영합니다.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {column.items.map((item) => (
                    <li key={item.label}>
                      <a className="text-ink-soft transition hover:text-ink" href={item.href}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 text-sm text-ink-muted sm:flex-row sm:items-center">
          <p>© 2026 FlowSpace</p>
          <p>한국어</p>
        </div>
      </div>
    </footer>
  );
}
