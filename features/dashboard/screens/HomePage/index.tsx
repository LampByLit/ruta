import Link from 'next/link'
import { PageContainer } from '../../components/PageContainer'

const tiles = [
  { href: '/dashboard/platform/dispatch', title: 'Dispatch', text: 'Send an open ride to a driver.' },
  { href: '/dashboard/platform/trips', title: 'Trips', text: 'Follow rides from pickup to dropoff.' },
  { href: '/dashboard/platform/drivers', title: 'Drivers', text: 'See who can take a ride.' },
  { href: '/dashboard/platform/vehicles', title: 'Vehicles', text: 'Cars that are on the road.' },
  { href: '/dashboard/platform/team', title: 'Team', text: 'People who run Ruta.' },
  { href: '/dashboard/platform/settings', title: 'Settings', text: 'Turn booking on or pause it.' },
]

export async function HomePage() {
  return (
    <PageContainer title="Ruta" header={<h1 className="text-lg font-semibold md:text-2xl">Ruta</h1>} breadcrumbs={[{ type: 'page', label: 'Dashboard' }]}>
      <div className="grid w-full max-w-4xl grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:p-6">
        {tiles.map(tile => (
          <Link key={tile.href} href={tile.href} className="rounded-2xl border border-[#47404a]/10 bg-white p-5 transition-colors hover:bg-[#ecfc03]">
            <h2 className="text-lg font-semibold text-[#47404a]">{tile.title}</h2>
            <p className="mt-1 text-sm text-[#47404a]/70">{tile.text}</p>
          </Link>
        ))}
      </div>
    </PageContainer>
  )
}

export default HomePage
