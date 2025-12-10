import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function ModuleCard(props: { href: string; title: string; description: string; Icon: any; featured?: boolean }) {
  const { href, title, description, Icon, featured } = props;

  return (
    <Link
      href={href}
      className="group relative block"
    >
      <div className={`relative h-full p-6 rounded-2xl border transition-all duration-300 ${featured
          ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 ring-1 ring-primary/10'
          : 'bg-card border-border/50 hover:border-border hover:shadow-lg'
        }`}>

        {/* Icon and Arrow */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl transition-all duration-300 ${featured
              ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
              : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
            }`}>
            <Icon size={24} strokeWidth={1.5} />
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <ArrowUpRight size={16} className="text-primary" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>

        {/* Featured indicator */}
        {featured && (
          <div className="absolute top-4 right-4">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
        )}
      </div>
    </Link>
  );
}
