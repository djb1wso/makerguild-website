export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Missing environment variables',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
    }

    const body = req.body;

    // Insert and return the new row ID
    const response = await fetch(`${supabaseUrl}/rest/v1/artisan_applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        brand_name:     body.brand_name     || null,
        artisan_name:   body.artisan_name   || null,
        city:           body.city           || null,
        state:          body.state          || null,
        what_you_make:  body.what_you_make  || null,
        style:          body.style          || null,
        style_other:    body.style_other    || null,
        price_range:    body.price_range    || null,
        ideal_customer: body.ideal_customer || null,
        feeling:        body.feeling        || null,
        platforms:      body.platforms      || null,
        website_status: body.website_status || null,
        email:          body.email          || null,
        phone:          body.phone          || null,
        status:         'new'
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        error: 'Supabase insert failed',
        status: response.status,
        detail: responseText
      });
    }

    const inserted = JSON.parse(responseText);
    const application_id = inserted[0].id;

    return res.status(200).json({ 
      success: true,
      application_id
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Exception caught',
      message: err.message
    });
  }
}
