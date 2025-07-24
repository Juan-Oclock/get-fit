import { useEffect } from 'react'
import { useLocation } from 'wouter'

export default function AuthCallback() {
  const [, setLocation] = useLocation()

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          setLocation('/?error=auth_failed')
          return
        }

        if (data.session) {
          console.log('Authentication successful, redirecting to dashboard')
          setLocation('/')
        } else {
          console.log('No session found, redirecting to landing')
          setLocation('/')
        }
      } catch (error) {
        console.error('Unexpected error during auth callback:', error)
        setLocation('/?error=unexpected')
      }
    }

    handleAuth()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}