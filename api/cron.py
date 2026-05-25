from http.server import BaseHTTPRequestHandler
import urllib.request
import json
from datetime import datetime
import os

NOTION_API_KEY = os.environ.get("NOTION_API_KEY")
STUDENT_DB_ID  = "3698fb930ae7812da2c8c34be1130655"
TUITION_DB_ID  = "36b8fb930ae781c59a35d1e5ce2753f3"

HEADERS = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def create_tuition_records():
    now = datetime.now()
    current_month_str = now.strftime("%Y년 %m월")
    current_date_prefix = now.strftime("%Y-%m")

    query_url = f"https://api.notion.com/v1/databases/{STUDENT_DB_ID}/query"
    query_payload = {"filter": {"property": "상태", "select": {"equals": "재원"}}}

    req = urllib.request.Request(query_url, data=json.dumps(query_payload).encode("utf-8"), headers=HEADERS, method="POST")
    with urllib.request.urlopen(req) as res:
        students_data = json.loads(res.read().decode("utf-8"))

    results = students_data.get("results", [])
    success_count = 0

    for student in results:
        student_id = student["id"]
        student_name = student["properties"]["이름"]["title"][0]["plain_text"]
        billing_title = f"{current_date_prefix} {student_name} 수강료"

        page_payload = {
            "parent": {"database_id": TUITION_DB_ID},
            "properties": {
                "청구서 제목": {"title": [{"text": {"content": billing_title}}]},
                "연결된학생": {"relation": [{"id": student_id}]},
                "청구월": {"select": {"name": current_month_str}},
                "결제 방식": {"select": {"name": "카드 결제"}},
                "입금확인": {"checkbox": False}
            }
        }

        create_url = "https://api.notion.com/v1/pages"
        create_req = urllib.request.Request(create_url, data=json.dumps(page_payload).encode("utf-8"), headers=HEADERS, method="POST")
        try:
            with urllib.request.urlopen(create_req) as c_res:
                success_count += 1
        except Exception as e:
            print(f"오류 발생: {e}")

    return f"🎉 {current_month_str} 청구서 총 {success_count}명 자동 생성 완료!"

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        auth_header = self.headers.get('X-Vercel-Cron-Auth')
        if auth_header is None:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Unauthorized")
            return

        try:
            message = create_tuition_records()
            self.send_response(200)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(message.encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Error: {str(e)}".encode('utf-8'))
