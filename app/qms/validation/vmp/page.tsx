'use client';

import { ValidationListPage } from '@/components/validation-mgmt/validation-list-page';

export default function VmpPage() {
  return (
    <ValidationListPage
      title="Validation Master Plan"
      description="Annual validation master plan register and scheduled qualifications"
      isVmp
    />
  );
}
