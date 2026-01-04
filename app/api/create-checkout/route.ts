import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRICES: Record<string, number> = {
  essential: 1000, // 10.00 EUR en centimes
  premium: 2000,   // 20.00 EUR
  exclusive: 5000, // 50.00 EUR
}

const TIER_NAMES: Record<string, string> = {
  essential: 'Pack Essential - 5 médias',
  premium: 'Pack Premium - 10 médias',
  exclusive: 'Pack Exclusive - 15 médias',
}

export async function POST(req: NextRequest) {
  try {
    const { tier, weekId, userId } = await req.json()

    if (!tier || !weekId || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (!PRICES[tier]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    // Vérifier que l'utilisateur n'a pas déjà acheté ce tier cette semaine
    const { data: existing } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('tier', tier)
      .eq('week_id', weekId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already purchased' }, { status: 400 })
    }

    // Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: TIER_NAMES[tier],
              description: `${weekId} - Accès permanent`,
            },
            unit_amount: PRICES[tier],
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/offers?success=true&tier=${tier}&week=${weekId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/offers?canceled=true`,
      metadata: {
        userId,
        tier,
        weekId,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe error:', error)
    return NextResponse.json({ error: 'Payment error' }, { status: 500 })
  }
}