'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { ConfigurationSectionId } from '@/lib/cpv-configuration-records';

export function ConfigurationTabs({
  sections,
  active,
  onChange,
  counts,
  children,
}: {
  sections: Array<{ id: ConfigurationSectionId; label: string }>;
  active: ConfigurationSectionId;
  onChange: (id: ConfigurationSectionId) => void;
  counts: Partial<Record<ConfigurationSectionId, number>>;
  children: React.ReactNode;
}) {
  return (
    <Tabs value={active} onValueChange={(v) => onChange(v as ConfigurationSectionId)}>
      <TabsList className="no-print flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        {sections.map((section) => (
          <TabsTrigger
            key={section.id}
            value={section.id}
            className="rounded-md border bg-white px-3 py-2 text-xs data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 sm:text-sm"
          >
            {section.label}
            {counts[section.id] !== undefined && (
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">{counts[section.id]}</Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

export function ConfigurationTabPanel({ id, children }: { id: ConfigurationSectionId; children: React.ReactNode }) {
  return <TabsContent value={id} className="mt-4">{children}</TabsContent>;
}
