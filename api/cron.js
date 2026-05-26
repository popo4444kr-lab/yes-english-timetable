const https = require('https');

function notionRequest(url, payload, token, method = 'POST') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method,
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
  const token = process.env.NOTION_API_KEY;
  const studentDbId  = '3698fb930ae7812da2c8c34be1130655';
  const tuitionDbId  = '36b8fb930ae781c59a35d1e5ce2753f3';
  const ledgerDbId   = '36c8fb930ae7815fb351c483ad4f0d8c';
  const fixedCostDbId = '36c8fb930ae7819fa1b3fe8bf0a67c27'; // 고정비 마스터 DB

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonth = `${year}년 ${month}월`;

  const results = { 수강료청구서: 0, 고정비: 0, errors: [] };

  // ── 1단계: 수강료 청구서 ──
  try {
    const studentRes = await notionRequest(
      `https://api.notion.com/v1/databases/${studentDbId}/query`,
      { filter: { property: '상태', select: { equals: '재원' } } },
      token
    );

    for (const s of studentRes.results || []) {
      try {
        const name = s.properties['이름'].title[0].plain_text;
        const tuition = s.properties['수강료'].formula.number || 0;
        await notionRequest('https://api.notion.com/v1/pages', {
          parent: { database_id: tuitionDbId },
          properties: {
            '청구서제목': { title: [{ type: 'text', text: { content: `${currentMonth} ${name} 수강료` } }] },
            '청구월':     { select: { name: currentMonth } },
            '납부상태':   { select: { name: '미납' } },
            '기본수강료': { number: tuition },
            '결제방식':   { select: { name: '카드결제' } },
            '입금확인':   { checkbox: false },
            '연결된학생': { relation: [{ id: s.id }] },
          }
        }, token);
        results.수강료청구서++;
      } catch(e) { results.errors.push(`수강료: ${e.message}`); }
    }
  } catch(e) { results.errors.push(`학생조회: ${e.message}`); }

  // ── 2단계: 고정비 마스터 DB에서 읽어오기 ──
  try {
    const fixedRes = await notionRequest(
      `https://api.notion.com/v1/databases/${fixedCostDbId}/query`,
      { filter: { property: '활성화', checkbox: { equals: true } } },
      token
    );

    for (const item of fixedRes.results || []) {
      try {
        const 내역명   = item.properties['내역명'].title[0].plain_text;
        const 금액     = item.properties['금액'].number || 0;
        const 출금일   = item.properties['출금일'].number || 1;
        const 출금계좌 = item.properties['출금계좌'].select?.name || '';
        const 공사구분 = item.properties['공사구분'].select?.name || '';

        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const day = String(Math.min(출금일, lastDay)).padStart(2, '0');
        const 날짜 = `${year}-${month}-${day}`;

        await notionRequest('https://api.notion.com/v1/pages', {
          parent: { database_id: ledgerDbId },
          properties: {
            '내역명':       { title: [{ type: 'text', text: { content: 내역명 } }] },
            '날짜':         { date: { start: 날짜 } },
            '금액':         { number: 금액 },
            '유형':         { select: { name: '지출' } },
            '비용유형':     { select: { name: '고정비' } },
            '공사구분':     { select: { name: 공사구분 } },
            '출금계좌':     { select: { name: 출금계좌 } },
            '세부카테고리': { select: { name: '관리비' } },
          }
        }, token);
        results.고정비++;
      } catch(e) { results.errors.push(`고정비_${e.message}`); }
    }
  } catch(e) { results.errors.push(`고정비조회: ${e.message}`); }

  res.status(200).json({
    message: `${currentMonth} 자동화 완료`,
    수강료청구서: results.수강료청구서,
    고정비: results.고정비,
    오류: results.errors
  });
};
