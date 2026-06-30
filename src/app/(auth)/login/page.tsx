import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Sign In — TLV Capital CRM',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  return <LoginForm searchParams={searchParams} />
}
