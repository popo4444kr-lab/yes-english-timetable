const https = require('https');

function notionQuery(dbId, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'api.notion.com',
      path: '/v1/databases/' + dbId + '/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('파싱오류')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const token = process.env.NOTION_API_KEY;
  const ledgerDbId = '36c8fb930ae7815fb351c483ad4f0d8c';
  const startDate = req.query.start;
  const endDate = req.query.end;

  if (!token) return res.status(500).json({ error: 'NOTION_API_KEY 없음' });
  if (!startDate || !endDate) return res.status(400).json({ error: 'start, end 파라미터 필요' });

  try {
    let allResults = [];
    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
      const payload = {
        filter: {
          and: [
            { property: '날짜', date: { on_or_after: startDate } },
            { property: '날짜', date: { on_or_before: endDate } }
          ]
        },
        page_size: 100
      };
      if (cursor) payload.start_cursor = cursor;

      const data = await notionQuery(ledgerDbId, payload, token);
      if (data.object === 'error') throw new Error(data.message);

      allResults = allResults.concat(data.results || []);
      hasMore = data.has_more || false;
      cursor = data.next_cursor;
    }

    let incomeTotal = 0;
    let expenseTotal = 0;
    const incomeList = [];
    const expenseList = [];

    for (const item of allResults) {
      const props = item.properties;
      const name = props['내역명'] && props['내역명'].title && props['내역명'].title[0]
        ? props['내역명'].title[0].plain_text : '이름없음';
      const amount = props['금액'] && props['금액'].number ? props['금액'].number : 0;
      const type = props['유형'] && props['유형'].select ? props['유형'].select.name : '';

      if (type === '수입') {
        incomeTotal += amount;
        incomeList.push({ name, amount });
      } else if (type === '지출') {
        expenseTotal += amount;
        expenseList.push({ name, amount });
      }
    }

    return res.status(200).json({
      startDate,
      endDate,
      수입합계: incomeTotal,
      지출합계: expenseTotal,
      순수익: incomeTotal - expenseTotal,
      수입내역: incomeList,
      지출내역: expenseList
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
