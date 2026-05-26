const https = require('https');

function notionPost(url, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(url, options, (res) => {
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
  const studentDbId = '3698fb930ae7812da2c8c34be1130655';
  const tuitionDbId = '36b8fb930ae781c59a35d1e5ce2753f3';
  const ledgerDbId  = '36c8fb930ae7815fb351c483ad4f0d8c';

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonth = `${year}년 ${month}월`;

  const results = { 수강료청구서: 0, 고정비: 0, errors: [] };

  // ── 1단계: 수강료 청구서 ──
  try {
    const studentRes = await notionPost(
      `https://api.notion.com/v1/databases/${studentDbId}/query`,
      { filter: { property: '상태', select: { equals: '재원' } } },
      token
    );

    for (const s of studentRes.results || []) {
      try {
        const name = s.properties['이름'].title[0].plain_text;
        const tuition = s.properties['수강료'].formula.number || 0;
        await notionPost('https://api.notion.com/v1/pages', {
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

  // ── 2단계: 고정비 ──
  const fixedCosts = [
    { 내역명: '프린트임대비',    날짜: `${year}-${month}-01`, 금액: 100000, 출금계좌: '대구은행 주통장 (072-13-063007)',     공사구분: '학원운영' },
    { 내역명: '소상공인대출',    날짜: `${year}-${month}-22`, 금액: 238224, 출금계좌: '대구은행 주통장 (072-13-063007)',     공사구분: '학원운영' },
    { 내역명: '주택담보대출',    날짜: `${year}-${month}-20`, 금액: 660300, 출금계좌: '대구은행 주통장 (072-13-063007)',     공사구분: '개인가정' },
    { 내역명: '국민연금',        날짜: `${year}-${month}-28`, 금액: 88420,  출금계좌: '대구은행 카드통장 (508-10-819325-3)', 공사구분: '개인가정' },
    { 내역명: '국민건강보험',    날짜: `${year}-${month}-28`, 금액: 223150, 출금계좌: '대구은행 카드통장 (508-10-819325-3)', 공사구분: '개인가정' },
    { 내역명: '교습소 인터넷비', 날짜: `${year}-${month}-25`, 금액: 61600,  출금계좌: '롯데카드',                           공사구분: '학원운영' },
    { 내역명: '교습소 정수기',   날짜: `${year}-${month}-11`, 금액: 29900,  출금계좌: '롯데카드',                           공사구분: '학원운영' },
    { 내역명: '클래스카드',      날짜: `${year}-${month}-16`, 금액: 28000,  출금계좌: '롯데카드',                           공사구분: '학원운영' },
    { 내역명: '실비보험',        날짜: `${year}-${month}-25`, 금액: 61120,  출금계좌: '롯데카드',                           공사구분: '개인가정' },
    { 내역명: '휴대폰비 아들',   날짜: `${year}-${month}-09`, 금액: 1970,   출금계좌: '롯데카드',                           공사구분: '개인가정' },
    { 내역명: '휴대폰비 아빠',   날짜: `${year}-${month}-26`, 금액: 2200,   출금계좌: '롯데카드',                           공사구분: '개인가정' },
    { 내역명: '푸른방송',        날짜: `${year}-${month}-20`, 금액: 15310,  출금계좌: '롯데카드',                           공사구분: '개인가정' },
    { 내역명: '아파트인터넷',    날짜: `${year}-${month}-20`, 금액: 22000,  출금계좌: '하나카드',                           공사구분: '개인가정' },
    { 내역명: '휴대폰 보험',     날짜: `${year}-${month}-25`, 금액: 7300,   출금계좌: '카카오페이머니',                      공사구분: '개인가정' },
    { 내역명: '어울림회비',      날짜: `${year}-${month}-20`, 금액: 20000,  출금계좌: '카카오페이머니',                      공사구분: '개인가정' },
    { 내역명: '아파트 관리비',   날짜: `${year}-${month}-25`, 금액: 0,      출금계좌: '하나카드',                           공사구분: '개인가정' },
    { 내역명: '대성에너지',      날짜: `${year}-${month}-28`, 금액: 0,      출금계좌: '롯데카드',                           공사구분: '개인가정' },
  ];

  for (const item of fixedCosts) {
    try {
      await notionPost('https://api.notion.com/v1/pages', {
        parent: { database_id: ledgerDbId },
        properties: {
          '내역명':       { title: [{ type: 'text', text: { content: item.내역명 } }] },
          '날짜':         { date: { start: item.날짜 } },
          '금액':         { number: item.금액 },
          '유형':         { select: { name: '지출' } },
          '비용유형':     { select: { name: '고정비' } },
          '공사구분':     { select: { name: item.공사구분 } },
          '출금계좌':     { select: { name: item.출금계좌 } },
          '세부카테고리': { select: { name: '관리비' } },
        }
      }, token);
      results.고정비++;
    } catch(e) { results.errors.push(`고정비_${item.내역명}: ${e.message}`); }
  }

  res.status(200).json({
    message: `${currentMonth} 자동화 완료`,
    수강료청구서: results.수강료청구서,
    고정비: results.고정비,
    오류: results.errors
  });
};
