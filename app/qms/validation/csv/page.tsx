'use client';

import { ValidationListPage } from '@/components/validation-mgmt/validation-list-page';

export default function CsvValidationPage() {
  return <ValidationListPage title="CSV Validation" description="Computer system validation with URS/FRS traceability and Part 11" validationType="Computer System Validation" />;
}
