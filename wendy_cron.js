// 웬디 원장님 전용 매월 1일 자동화 시스템 (wendy_cron.js)
const https = require('https');

function notionPost(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'api.notion.com',
      path: path,
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
      res.on('end', () => resolve(JSON.parse(body)));
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
  // 📸 스크린샷으로 기억해 둔 웬디님 고유 ID 자동 연결
  const studentDbId = '36e72da63cf581168882e9e932548acc';
  const tuitionDbId = '36e72da63cf58195b4dcfcb0568a4b96';

  if (!token) return res.status(500).json({ error: 'NOTION_API_KEY 환경변수 없음' });

  try {
    // 1단계: 학생DB에서 재원 상태인 학생 조회
    const queryPayload = { filter: { property: '상태', select: { equals: '재원' } } };
    const studentsData = await notionPost('/v1/databases/' + studentDbId + '/query', queryPayload, token);
    const students = studentsData.results || [];

    let count = 0;
    const today = new Date();
    const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
    const titlePrefix = today.getFullYear() + '년 ' + currentMonth + '월 ';

    // 2단계: 각 학생별 수강료 청구서 자동 생성
    for (const student of students) {
      const props = student.properties;
      const name = props['이름'].title[0] ? props['이름'].title[0].plain_text : '이름없음';
      const fee = props['수강료'] && props['수강료'].number ? props['수강료'].number : 0;

      const newPagePayload = {
        parent: { database_id: tuitionDbId },
        properties: {
          '청구서제목': { title: [{ text: { content: titlePrefix + name + ' 수강료' } }] },
          '기본수강료': { number: fee },
          '납부상태': { select: { name: '미납' } },
          '입금확인': { checkbox: false }
        }
      };
      await notionPost('/v1/pages', newPagePayload, token);
      count++;
    }

    return res.status(200).json({ success: true, message: `웬디님 자동화: ${count}명의 청구서 생성 완료` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
