export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/rest/v1/artisan_applications`, {
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

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
