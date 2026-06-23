export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!anthropicKey) {
      return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
    }

    const { application_id } = req.body;
    if (!application_id) {
      return res.status(400).json({ error: 'Missing application_id' });
    }

    // ── Fetch the artisan application from Supabase ──
    const appResponse = await fetch(
      `${supabaseUrl}/rest/v1/artisan_applications?id=eq.${application_id}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    const apps = await appResponse.json();
    if (!apps || apps.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const app = apps[0];

    // ── Helper: call Claude API and strip markdown fences ──
    async function callClaude(systemPrompt, userPrompt) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await response.json();
      const raw = data.content[0].text;
      // Strip markdown code fences if present
      return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    }

    // ── Build base context from intake form ──
    const artisanContext = `
Artisan name: ${app.artisan_name}
Brand name: ${app.brand_name}
Location: ${app.city}, ${app.state}
What they make: ${app.what_you_make}
Aesthetic style: ${app.style}${app.style_other ? ' — ' + app.style_other : ''}
Price range: ${app.price_range}
Ideal customer: ${app.ideal_customer}
What they want customers to feel: ${app.feeling || 'not specified'}
Current platforms: ${app.platforms || 'none'}
    `.trim();

    // ── PROMPT 1: Brand Voice Document ──
    const brandVoice = await callClaude(
      `You are a brand strategist specializing in handmade craft businesses. 
       Extract and articulate the core brand voice for this artisan. 
       Be specific — no generic filler. Every word should feel true to THIS maker.
       Always respond with pure JSON only. No markdown. No code fences. No explanation.`,
      `Based on this artisan's intake information, create a Brand Voice Document:

${artisanContext}

Return a JSON object with these exact keys:
{
  "tone_words": ["3-5 single adjectives that describe this brand's voice"],
  "audience_description": "2-3 sentences describing the ideal customer in vivid detail",
  "brand_personality": "2-3 sentences — if this brand were a person, who would they be?",
  "what_makes_them_different": "1-2 sentences on what makes this maker genuinely unique",
  "words_to_avoid": ["3-5 words or phrases that would feel wrong for this brand"],
  "content_themes": ["4-5 recurring themes that should run through all content"]
}
Return only valid JSON. No markdown. No code fences. No explanation.`
    );

    const brandVoiceData = JSON.parse(brandVoice);

    // ── PROMPT 2: Brand Narrative Arc ──
    const brandNarrative = await callClaude(
      `You are a brand storyteller. Using the brand voice as your guide, 
       craft the foundational story of this maker. This narrative will underpin 
       ALL future content. It must feel personal, specific, and emotionally resonant.
       Always respond with pure JSON only. No markdown. No code fences. No explanation.`,
      `Brand Voice Document:
${JSON.stringify(brandVoiceData, null, 2)}

Artisan context:
${artisanContext}

Write a Brand Narrative Arc. Return as JSON:
{
  "origin": "2-3 sentences: Why does ${app.artisan_name} make what they make?",
  "craft": "2-3 sentences: What is distinctive about how they work and what they create?",
  "customer": "2 sentences: Who is this for, and why does it matter to them?",
  "promise": "1 sentence: What does ${app.brand_name} stand for?",
  "campaign_hook": "1 memorable sentence that could anchor 90 days of content"
}
Return only valid JSON. No markdown. No code fences. No explanation.`
    );

    const narrativeData = JSON.parse(brandNarrative);

    // ── PROMPT 3: Website Copy ──
    const websiteCopy = await callClaude(
      `You are a conversion copywriter who specializes in handmade craft brands. 
       Write website copy that sounds like the maker wrote it on their best day.
       Warm, specific, and real. No corporate language. No clichés.
       Always respond with pure JSON only. No markdown. No code fences. No explanation.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Brand Narrative: ${JSON.stringify(narrativeData)}
Artisan context: ${artisanContext}

Write complete website copy. Return as JSON:
{
  "homepage_headline": "A compelling 6-10 word headline",
  "homepage_subheadline": "One sentence that expands on the headline",
  "hero_body": "2-3 sentences for the homepage hero section",
  "about_headline": "Headline for the About page",
  "about_body": "3-4 paragraph about page in first person from ${app.artisan_name}'s voice",
  "brand_tagline": "A 4-7 word tagline for ${app.brand_name}",
  "seo_page_title": "Homepage SEO title under 60 characters",
  "seo_meta_description": "Homepage meta description under 155 characters",
  "faq": [
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ]
}
Return only valid JSON. No markdown. No code fences. No explanation.`
    );

    const websiteData = JSON.parse(websiteCopy);

    // ── PROMPT 4: Product Description Template ──
    const productCopy = await callClaude(
      `You are a product copywriter for handmade craft brands. 
       Write descriptions that are sensory, specific, and make the reader feel something.
       Always respond with pure JSON only. No markdown. No code fences. No explanation.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Artisan context: ${artisanContext}

Create a product description system. Return as JSON:
{
  "template": "A reusable fill-in-the-blank template. Use [PRODUCT_NAME], [KEY_DETAIL], [MATERIAL], [DIMENSION] as placeholders.",
  "sample_descriptions": [
    "Sample description 1 — a flagship piece (3-4 sentences)",
    "Sample description 2 — a gift-friendly piece (3-4 sentences)",
    "Sample description 3 — a best-seller piece (3-4 sentences)"
  ],
  "seo_keywords": ["8-10 relevant search keywords for this type of craft"]
}
Return only valid JSON. No markdown. No code fences. No explanation.`
    );

    const productData = JSON.parse(productCopy);

    // ── PROMPT 5: 90-Day Campaign Brief ──
    const campaignBrief = await callClaude(
      `You are a digital marketing strategist for craft and maker brands.
       You believe in traffic-driven commerce: build an audience first, 
       let the website do the selling. Content is about the MAKER and their WORLD,
       not individual products.
       Always respond with pure JSON only. No markdown. No code fences. No explanation.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Brand Narrative: ${JSON.stringify(narrativeData)}
Artisan context: ${artisanContext}

Create a 90-Day Brand Awareness Campaign Brief. Return as JSON:
{
  "campaign_theme": "A memorable 3-6 word campaign theme",
  "campaign_goal": "One sentence: what does success look like after 90 days?",
  "content_pillars": [
    {"pillar": "Pillar name", "description": "What this covers and why", "example_post": "An example post idea"},
    {"pillar": "Pillar name", "description": "What this covers and why", "example_post": "An example post idea"},
    {"pillar": "Pillar name", "description": "What this covers and why", "example_post": "An example post idea"}
  ],
  "posting_cadence": "Recommended posts per week and best days/times",
  "first_week_plan": ["Day 1 post idea", "Day 3 post idea", "Day 5 post idea"],
  "channels": ["Ranked list of channels to prioritize"],
  "metrics_to_watch": ["3-4 metrics that matter most for this campaign phase"]
}
Return only valid JSON. No markdown. No code fences. No explanation.`
    );

    const campaignData = JSON.parse(campaignBrief);

    // ── PROMPT 6: 20 Seed Social Posts ──
    const socialPosts = await callClaude(
      `You are a social media content writer for handmade craft brands.
       Write posts that feel human — like the maker posted them on a good day.
       No corporate language. Focus on brand story, maker process, authentic moments.
       Do NOT write product-listing posts. Write brand-building posts.
       Always respond with pure JSON only. No markdown. No code fences. No explanation.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Campaign Brief: ${JSON.stringify(campaignData)}
Artisan context: ${artisanContext}

Write 20 Instagram/Pinterest captions for the first 90-day campaign.
Mix across: behind-the-scenes process, maker story, inspiration, customer connection, craft philosophy.

Return as JSON:
{
  "posts": [
    {
      "id": 1,
      "pillar": "which content pillar this belongs to",
      "caption": "Full caption text",
      "hashtags": "#tag1 #tag2 #tag3 (8-12 relevant hashtags)",
      "visual_direction": "Brief note on what photo or video would work best"
    }
  ]
}
Return only valid JSON. No markdown. No code fences. No explanation.`
    );

    const socialData = JSON.parse(socialPosts);

    // ── PROMPT 7: 4-Email Welcome Sequence ──
    const emailSequence = await callClaude(
      `You are an email marketing specialist for handmade craft brands.
       Write emails that feel personal — like a letter from the maker, not a marketing blast.
       Warm, specific, story-driven. Each email has one job.
       Always respond with pure JSON only. No markdown. No code fences. No explanation.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Brand Narrative: ${JSON.stringify(narrativeData)}
Artisan context: ${artisanContext}

Write a 4-email welcome sequence. Return as JSON:
{
  "emails": [
    {
      "email_number": 1,
      "send_timing": "Immediately on subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "Full email body — warm welcome, brand story, what to expect. 150-200 words."
    },
    {
      "email_number": 2,
      "send_timing": "3 days after subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "The making process — how ${app.artisan_name} works, what goes into each piece. 150-200 words."
    },
    {
      "email_number": 3,
      "send_timing": "7 days after subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "Introduce the collection — not a product listing, but a story about the work. 150-200 words."
    },
    {
      "email_number": 4,
      "send_timing": "14 days after subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "A personal invitation to visit the shop — with a genuine reason to come now. 150-200 words."
    }
  ]
}
Return only valid JSON. No markdown. No code fences. No explanation.`
    );

    const emailData = JSON.parse(emailSequence);

    // ── Assemble all outputs ──
    const allAssets = {
      application_id,
      brand_name: app.brand_name,
      artisan_name: app.artisan_name,
      generated_at: new Date().toISOString(),
      brand_voice: brandVoiceData,
      brand_narrative: narrativeData,
      website_copy: websiteData,
      product_copy: productData,
      campaign_brief: campaignData,
      social_posts: socialData,
      email_sequence: emailData
    };

    // ── Save assets to Supabase artisan_assets table ──
    await fetch(`${supabaseUrl}/rest/v1/artisan_assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        application_id,
        assets: allAssets
      })
    });

    // ── Update application status ──
    await fetch(
      `${supabaseUrl}/rest/v1/artisan_applications?id=eq.${application_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ status: 'assets_generated' })
      }
    );

    return res.status(200).json({
      success: true,
      application_id,
      assets: allAssets
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Pipeline failed',
      message: err.message
    });
  }
}
