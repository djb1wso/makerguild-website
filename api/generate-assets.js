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
    async function callClaude(systemPrompt, userPrompt, maxTokens = 4000) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await response.json();
      if (!data.content || !data.content[0]) {
        throw new Error('No content returned from Claude: ' + JSON.stringify(data));
      }
      const raw = data.content[0].text;
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

    const jsonInstruction = 'Return only valid JSON. No markdown. No code fences. No explanation. No text before or after the JSON object.';

    // ── PROMPT 1: Brand Voice Document ──
    const brandVoice = await callClaude(
      `You are a brand strategist specializing in handmade craft businesses. 
       Be specific — no generic filler. Every word should feel true to THIS maker.
       Always respond with pure JSON only. No markdown. No code fences.`,
      `Create a Brand Voice Document for this artisan:

${artisanContext}

${jsonInstruction}
{
  "tone_words": ["3-5 adjectives describing this brand voice"],
  "audience_description": "2-3 sentences describing the ideal customer",
  "brand_personality": "2-3 sentences — if this brand were a person, who would they be?",
  "what_makes_them_different": "1-2 sentences on what makes this maker unique",
  "words_to_avoid": ["3-5 words that would feel wrong for this brand"],
  "content_themes": ["4-5 recurring themes for all content"]
}`
    );
    const brandVoiceData = JSON.parse(brandVoice);

    // ── PROMPT 2: Brand Narrative Arc ──
    const brandNarrative = await callClaude(
      `You are a brand storyteller. Craft the foundational story of this maker.
       Personal, specific, emotionally resonant. Pure JSON only.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Artisan context: ${artisanContext}

${jsonInstruction}
{
  "origin": "2-3 sentences: Why does ${app.artisan_name} make what they make?",
  "craft": "2-3 sentences: What is distinctive about their work?",
  "customer": "2 sentences: Who is this for and why does it matter?",
  "promise": "1 sentence: What does ${app.brand_name} stand for?",
  "campaign_hook": "1 memorable sentence to anchor 90 days of content"
}`
    );
    const narrativeData = JSON.parse(brandNarrative);

    // ── PROMPT 3: Website Copy ──
    const websiteCopy = await callClaude(
      `You are a conversion copywriter for handmade craft brands.
       Warm, specific, real. No corporate language. No clichés. Pure JSON only.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Narrative: ${JSON.stringify(narrativeData)}
Artisan context: ${artisanContext}

${jsonInstruction}
{
  "homepage_headline": "6-10 word headline",
  "homepage_subheadline": "One expanding sentence",
  "hero_body": "2-3 sentences for hero section",
  "about_headline": "About page headline",
  "about_body": "3 paragraphs in first person from ${app.artisan_name}",
  "brand_tagline": "4-7 word tagline",
  "seo_page_title": "Under 60 characters",
  "seo_meta_description": "Under 155 characters",
  "faq": [
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ]
}`
    );
    const websiteData = JSON.parse(websiteCopy);

    // ── PROMPT 4: Product Description Template ──
    const productCopy = await callClaude(
      `You are a product copywriter for handmade craft brands.
       Sensory, specific, makes the reader feel something. Pure JSON only.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Artisan context: ${artisanContext}

${jsonInstruction}
{
  "template": "Fill-in-the-blank template using [PRODUCT_NAME], [KEY_DETAIL], [MATERIAL], [DIMENSION]",
  "sample_descriptions": [
    "Flagship piece — 3-4 sentences",
    "Gift-friendly piece — 3-4 sentences",
    "Best-seller piece — 3-4 sentences"
  ],
  "seo_keywords": ["8-10 relevant search keywords"]
}`
    );
    const productData = JSON.parse(productCopy);

    // ── PROMPT 5: 90-Day Campaign Brief ──
    const campaignBrief = await callClaude(
      `You are a digital marketing strategist for craft brands.
       Traffic-driven commerce: build audience first, let website sell.
       Content is about the MAKER not individual products. Pure JSON only.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Narrative: ${JSON.stringify(narrativeData)}
Artisan context: ${artisanContext}

${jsonInstruction}
{
  "campaign_theme": "3-6 word campaign theme",
  "campaign_goal": "One sentence: what does success look like after 90 days?",
  "content_pillars": [
    {"pillar": "Name", "description": "What this covers and why", "example_post": "Example idea"},
    {"pillar": "Name", "description": "What this covers and why", "example_post": "Example idea"},
    {"pillar": "Name", "description": "What this covers and why", "example_post": "Example idea"}
  ],
  "posting_cadence": "Posts per week and best days/times",
  "first_week_plan": ["Day 1 idea", "Day 3 idea", "Day 5 idea"],
  "channels": ["Ranked channels to prioritize"],
  "metrics_to_watch": ["3-4 key metrics for this phase"]
}`
    );
    const campaignData = JSON.parse(campaignBrief);

    // ── PROMPT 6a: Social Posts 1-10 ──
    const socialPosts1 = await callClaude(
      `You are a social media writer for handmade craft brands.
       Human, warm, brand-building. NOT product-listing posts.
       Pure JSON only. No markdown. No code fences.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Campaign: ${JSON.stringify(campaignData)}
Artisan context: ${artisanContext}

Write posts 1-10 of a 20-post Instagram/Pinterest series.
Focus on: maker story, behind-the-scenes process, craft philosophy, inspiration.

${jsonInstruction}
{
  "posts": [
    {
      "id": 1,
      "pillar": "content pillar name",
      "caption": "Full caption",
      "hashtags": "8-12 hashtags",
      "visual_direction": "What photo or video to use"
    }
  ]
}
Include exactly 10 posts numbered 1-10.`,
      6000
    );
    const socialData1 = JSON.parse(socialPosts1);

    // ── PROMPT 6b: Social Posts 11-20 ──
    const socialPosts2 = await callClaude(
      `You are a social media writer for handmade craft brands.
       Human, warm, brand-building. NOT product-listing posts.
       Pure JSON only. No markdown. No code fences.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Campaign: ${JSON.stringify(campaignData)}
Artisan context: ${artisanContext}

Write posts 11-20 of a 20-post Instagram/Pinterest series.
These should be DIFFERENT from the first 10 — new angles, new moments.
Focus on: customer connection, seasonal moments, craft detail, behind-the-scenes.

${jsonInstruction}
{
  "posts": [
    {
      "id": 11,
      "pillar": "content pillar name",
      "caption": "Full caption",
      "hashtags": "8-12 hashtags",
      "visual_direction": "What photo or video to use"
    }
  ]
}
Include exactly 10 posts numbered 11-20.`,
      6000
    );
    const socialData2 = JSON.parse(socialPosts2);

    // Merge posts
    const socialData = {
      posts: [...socialData1.posts, ...socialData2.posts]
    };

    // ── PROMPT 7: 4-Email Welcome Sequence ──
    const emailSequence = await callClaude(
      `You are an email marketer for handmade craft brands.
       Personal, warm, story-driven. Like a letter from the maker.
       Each email has ONE job. Pure JSON only.`,
      `Brand Voice: ${JSON.stringify(brandVoiceData)}
Narrative: ${JSON.stringify(narrativeData)}
Artisan context: ${artisanContext}

Write a 4-email welcome sequence.

${jsonInstruction}
{
  "emails": [
    {
      "email_number": 1,
      "send_timing": "Immediately on subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "Warm welcome and brand story. 150-200 words."
    },
    {
      "email_number": 2,
      "send_timing": "3 days after subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "The making process. 150-200 words."
    },
    {
      "email_number": 3,
      "send_timing": "7 days after subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "The collection story — not a product list. 150-200 words."
    },
    {
      "email_number": 4,
      "send_timing": "14 days after subscribe",
      "subject_line": "...",
      "preview_text": "...",
      "body": "Personal invitation to visit the shop. 150-200 words."
    }
  ]
}`,
      6000
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

    // ── Save to Supabase artisan_assets ──
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
      message: err.message,
      stack: err.stack
    });
  }
}
