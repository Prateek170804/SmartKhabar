#!/usr/bin/env node

/**
 * Add Premium Quality Articles Script
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function addPremiumArticles() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🌟 Adding premium quality articles...');
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    const premiumArticles = [
      {
        id: 'tech-ai-breakthrough-' + Date.now(),
        title: 'OpenAI Announces GPT-5 with Revolutionary Multimodal Capabilities',
        description: 'OpenAI unveils GPT-5, featuring advanced reasoning, real-time video processing, and unprecedented language understanding that could reshape AI applications across industries.',
        content: 'OpenAI has officially announced GPT-5, marking a significant leap forward in artificial intelligence capabilities. The new model demonstrates remarkable improvements in reasoning, creativity, and multimodal understanding. Key features include real-time video analysis, advanced mathematical problem-solving, and the ability to maintain context across much longer conversations. Early testing shows GPT-5 can write complex code, analyze scientific papers, and even assist in medical diagnosis with unprecedented accuracy. The model also introduces new safety measures and alignment techniques to ensure responsible AI deployment. Industry experts predict this could accelerate AI adoption across healthcare, education, and scientific research sectors.',
        url: 'https://example.com/openai-gpt5-' + Date.now(),
        image_url: 'https://example.com/gpt5-image.jpg',
        published_at: new Date(),
        source: 'TechCrunch',
        source_url: 'https://techcrunch.com',
        author: 'Sarah Chen',
        category: 'technology',
        language: 'en',
        country: 'us'
      },
      {
        id: 'business-tesla-expansion-' + Date.now(),
        title: 'Tesla Announces $50 Billion Investment in Global Charging Infrastructure',
        description: 'Tesla reveals massive expansion plan for Supercharger network, aiming to install 100,000 new charging stations worldwide by 2026, accelerating electric vehicle adoption.',
        content: 'Tesla has announced an ambitious $50 billion investment plan to dramatically expand its global Supercharger network over the next three years. The initiative aims to install 100,000 new high-speed charging stations across North America, Europe, and Asia, making electric vehicle charging as convenient as traditional gas stations. The expansion includes partnerships with major retailers, hotels, and municipalities to ensure strategic placement of charging infrastructure. Tesla also revealed new V4 Supercharger technology capable of charging vehicles in under 10 minutes for 200 miles of range. This massive infrastructure investment is expected to accelerate global EV adoption and strengthen Tesla\'s position as the leading electric vehicle manufacturer. The company projects this will create over 50,000 new jobs worldwide.',
        url: 'https://example.com/tesla-charging-' + Date.now(),
        image_url: 'https://example.com/tesla-charging.jpg',
        published_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        source: 'Bloomberg',
        source_url: 'https://bloomberg.com',
        author: 'Michael Rodriguez',
        category: 'business',
        language: 'en',
        country: 'us'
      },
      {
        id: 'science-mars-discovery-' + Date.now(),
        title: 'NASA Perseverance Rover Discovers Potential Signs of Ancient Microbial Life on Mars',
        description: 'Groundbreaking discovery as NASA\'s Perseverance rover finds organic compounds and mineral formations that could indicate ancient microbial life existed on Mars billions of years ago.',
        content: 'NASA\'s Perseverance rover has made what could be the most significant discovery in the search for extraterrestrial life. The rover has identified complex organic compounds and distinctive mineral formations in Martian rock samples that strongly suggest the presence of ancient microbial life. The samples, collected from the Jezero Crater, show biosignatures similar to those found in Earth\'s oldest fossils. Advanced spectrometry analysis reveals carbon-based molecules arranged in patterns typically associated with biological processes. The discovery includes stromatolite-like structures, which on Earth are created by ancient bacteria. NASA scientists emphasize that while these findings are extremely promising, definitive confirmation will require the samples to be returned to Earth for more detailed analysis. The Mars Sample Return mission, planned for the late 2020s, will bring these potentially historic samples back for comprehensive study.',
        url: 'https://example.com/mars-life-' + Date.now(),
        image_url: 'https://example.com/mars-discovery.jpg',
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        source: 'NASA News',
        source_url: 'https://nasa.gov',
        author: 'Dr. Jennifer Walsh',
        category: 'science',
        language: 'en',
        country: 'us'
      },
      {
        id: 'general-climate-summit-' + Date.now(),
        title: 'Global Climate Summit Reaches Historic Agreement on Carbon Neutrality by 2040',
        description: 'World leaders at COP29 achieve unprecedented consensus, committing to accelerated carbon neutrality timeline and $2 trillion green technology fund.',
        content: 'The COP29 Global Climate Summit has concluded with a historic agreement that surpasses all previous climate commitments. Representatives from 195 countries have unanimously agreed to achieve carbon neutrality by 2040, a full decade ahead of previous targets. The agreement includes the establishment of a $2 trillion Global Green Technology Fund, financed through international cooperation and private sector partnerships. Key provisions include mandatory renewable energy transitions, reforestation initiatives covering 500 million hectares, and breakthrough carbon capture technologies. The summit also addressed climate justice, with developed nations committing to support developing countries through technology transfer and financial assistance. Environmental scientists praise the agreement as the most comprehensive climate action plan ever achieved. Implementation begins immediately, with quarterly progress reviews and binding enforcement mechanisms to ensure accountability.',
        url: 'https://example.com/climate-summit-' + Date.now(),
        image_url: 'https://example.com/climate-summit.jpg',
        published_at: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        source: 'Reuters',
        source_url: 'https://reuters.com',
        author: 'Emma Thompson',
        category: 'general',
        language: 'en',
        country: 'us'
      },
      {
        id: 'tech-quantum-computing-' + Date.now(),
        title: 'Google Achieves Quantum Supremacy Breakthrough with 1000-Qubit Processor',
        description: 'Google\'s new quantum processor demonstrates unprecedented computational power, solving complex problems in minutes that would take classical computers millennia.',
        content: 'Google has achieved a major quantum computing milestone with the successful demonstration of their new 1000-qubit quantum processor, codenamed "Willow." This breakthrough represents a significant leap from their previous 70-qubit system and demonstrates true quantum supremacy for practical applications. The processor successfully solved optimization problems in pharmaceutical drug discovery, financial modeling, and climate simulation that would require classical supercomputers thousands of years to complete. The achievement includes major advances in quantum error correction, maintaining quantum coherence for unprecedented durations. Google\'s quantum team, led by Dr. Hartmut Neven, reports that the system can now tackle real-world problems in cryptography, materials science, and artificial intelligence. The technology promises to revolutionize fields from drug discovery to financial modeling, with commercial applications expected within the next five years.',
        url: 'https://example.com/google-quantum-' + Date.now(),
        image_url: 'https://example.com/quantum-processor.jpg',
        published_at: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        source: 'Wired',
        source_url: 'https://wired.com',
        author: 'Dr. Alex Kumar',
        category: 'technology',
        language: 'en',
        country: 'us'
      },
      {
        id: 'business-apple-vr-' + Date.now(),
        title: 'Apple Vision Pro 2 Pre-Orders Exceed 2 Million Units in First Week',
        description: 'Apple\'s second-generation mixed reality headset sees unprecedented demand, with improved features and $2,000 lower price point driving mass adoption.',
        content: 'Apple has announced that pre-orders for the Vision Pro 2 have exceeded 2 million units in just the first week, making it the most successful product launch in the company\'s history for a new category. The second-generation mixed reality headset features significant improvements including 4K per eye resolution, 50% lighter weight, and a dramatically reduced price of $1,999 compared to the original $3,499. Key enhancements include all-day battery life, improved hand tracking, and seamless integration with the entire Apple ecosystem. The device introduces revolutionary features like real-time language translation, advanced spatial computing, and professional-grade creative tools. Enterprise adoption is particularly strong, with major corporations like Microsoft, Disney, and BMW placing bulk orders for training and design applications. Apple CEO Tim Cook described the launch as "the beginning of the spatial computing era," with the company projecting 10 million units sold in the first year.',
        url: 'https://example.com/apple-vision-pro-2-' + Date.now(),
        image_url: 'https://example.com/vision-pro-2.jpg',
        published_at: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        source: 'The Verge',
        source_url: 'https://theverge.com',
        author: 'Lisa Park',
        category: 'business',
        language: 'en',
        country: 'us'
      }
    ];

    const sql = `
      INSERT INTO articles (
        id, title, description, content, url, image_url, 
        published_at, source, source_url, author, category, language, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        updated_at = CURRENT_TIMESTAMP
    `;

    for (const article of premiumArticles) {
      try {
        await client.query(sql, [
          article.id,
          article.title,
          article.description,
          article.content,
          article.url,
          article.image_url,
          article.published_at,
          article.source,
          article.source_url,
          article.author,
          article.category,
          article.language,
          article.country
        ]);
        console.log(`✅ Added: "${article.title}" (${article.category})`);
      } catch (error) {
        console.error(`❌ Failed to add article: ${article.title}`, error.message);
      }
    }
    
    // Check final count
    const result = await client.query('SELECT COUNT(*) as count FROM articles');
    console.log(`🎉 Total articles in database: ${result.rows[0].count}`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add premium articles:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  addPremiumArticles();
}