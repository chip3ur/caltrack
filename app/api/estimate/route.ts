import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: `Tu es un assistant nutritionnel. L'utilisateur décrit ce qu'il a mangé. Réponds UNIQUEMENT en JSON sans markdown :
{"items":[{"name":"...","qty":"...","cal":123}],"total":456,"message":"..."}
Message court, encourageant, en français.`,
        messages: [{ role: 'user', content: message }],
      }),
    })

    const data = await res.json()

    // Log pour déboguer
    console.log('Réponse Anthropic:', JSON.stringify(data))

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 })
    }

    const text = data.content.map((i: { text?: string }) => i.text || '').join('')
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    const display = parsed.items.map((i: { name: string; qty: string; cal: number }) =>
      `${i.name} (${i.qty}) — ${i.cal} kcal`).join('\n') + `\n\nTotal : ${parsed.total} kcal\n${parsed.message}`

    return NextResponse.json({ text: display, total: parsed.total })

  } catch (e) {
    console.error('Erreur estimate:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}