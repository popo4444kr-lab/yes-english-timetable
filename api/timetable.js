export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const DATABASE_ID = process.env.DATABASE_ID;

  try {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: '상태',
            select: { equals: '재원' }
          }
        })
      }
    );

    const data = await response.json();
    const students = data.results.map(page => {
      const props = page.properties;
      const getName = p => p?.title?.[0]?.plain_text || p?.rich_text?.[0]?.plain_text || '';
      const getMultiSelect = p => p?.multi_select?.map(m => m.name) || [];
      
      return {
        name: getName(props['이름']),
        월: getMultiSelect(props['월_시간']),
        화: getMultiSelect(props['화_시간']),
        수: getMultiSelect(props['수_시간']),
        목: getMultiSelect(props['목_시간']),
        금: getMultiSelect(props['금_시간']),
      };
    });

    res.status(200).json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
