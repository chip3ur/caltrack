import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { targetUserId } = await req.json()
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId requis' }, { status: 400 })

    // Vérifier le token de l'appelant
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Client avec la clé anon pour vérifier la session admin
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 })

    // Vérifier que l'appelant est admin
    const { data: profile } = await anonClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    // Client service role pour l'impersonification
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Récupérer l'email de la cible
    const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId)
    if (targetError || !targetData.user?.email) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    // Générer un lien magic link pour se connecter en tant que cet utilisateur
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetData.user.email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '')}/dashboard` },
    })
    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: 'Erreur génération du lien' }, { status: 500 })
    }

    return NextResponse.json({ url: linkData.properties.action_link })
  } catch (e) {
    console.error('Erreur impersonate:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
