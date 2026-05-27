const https = require('https');

function notionPost(url, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = process.env.NOTION_API_KEY;
  const ledgerDbId = '36c8fb930ae7815fb351c483ad4f0d8c';
  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ error: 'month 파라미터 필요 (예: 2026년 05월)' });
  }

  try {
    let allResults = [];
    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
      const payload = {
        filter: {
          property: '정산년월',
          formula: { string: { equals: month } }
        },
        page_size: 100,
        ...(cursor && { start_cursor: cursor })
      };

      const data = await notionPost(
        `https://api.notion.com/v1/databases/${ledgerDbId}/query`,
        payload,
        token
      );

      allResults = [...allResults, ...(data.results || [])];
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    let 수입합계 = 0;
    let 지출합계 = 0;
    const 수입내역 = [];
    const 지출내역 = [];

    for (const item of allResults) {
      const 내역명 = item.properties['내역명']?.title?.[0]?.plain_text || '';
      const 금액 = item.properties['금액']?.number || 0;
      const 유형 = item.properties['유형']?.select?.name || '';
      const 세부카테고리 = item.properties['세부카테고리']?.select?.name || '';
      const 공사구분 = item.properties['공사구분']?.select?.name || '';

      if (유형 === '수입') {
        수입합계 += 금액;
        수입내역.push({ 내역명, 금액, 세부카테고리, 공사구분 });
      } else if (유형 === '지출') {
        지출합계 += 금액;
        지출내역.push({ 내역명, 금액, 세부카테고리, 공사구분 });
      }
    }

    res.status(200).json({
      month,
      수입합계,
      지출합계,
      순수익: 수입합계 - 지출합계,
      수입내역,
      지출내역
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
