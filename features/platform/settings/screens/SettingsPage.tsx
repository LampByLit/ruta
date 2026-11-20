import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { PlatformHeader } from '@/features/platform/components/PlatformPage'
import { FleetBrandingSettings } from '../branding/FleetBrandingSettings'
import { FleetOperationsSettings } from '../operations/FleetOperationsSettings'

export function SettingsPage() {
  return <>
    <PageBreadcrumbs items={[{ type: 'link', label: 'Dashboard', href: '' }, { type: 'page', label: 'Settings' }]} />
    <div className="mx-auto w-full max-w-4xl space-y-8 p-4 pb-24 md:p-6">
      <PlatformHeader title="Settings" />
      <FleetOperationsSettings />
      <FleetBrandingSettings />
    </div>
  </>
}
export default SettingsPage
