export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Debug: check if env vars are present
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ 
        error: 'Missing environment variables',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();

    const insertUrl = `${supabaseUrl}/rest/v1/artisan_applications`;

    const response = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        brand_name:      body.brand_name      || null,
        artisan_name:    body.artisan_name    || null,
        city:            body.city            || null,
        state:           body.state           || null,
        what_you_make:   body.what_you_make   || null,
        style:           body.style           || null,
        style_other:     body.style_other     || null,
        price_range:     body.price_range     || null,
        ideal_customer:  body.ideal_customer  || null,
        feeling:         body.feeling         || null,
        platforms:       body.platforms       || null,
        website_status:  body.website_status  || null,
        email:           body.email           || null,
        phone:           body.phone           || null,
        status:          'new'
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: 'Supabase insert failed',
        status: response.status,
        detail: responseText
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Exception caught',
      message: err.message,
      stack: err.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
