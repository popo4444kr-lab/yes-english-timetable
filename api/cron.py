import os
import requests
from datetime import datetime

def handler(request):
    # 1. 버셀 환경변수에서 노션 금고 열쇠를 호출합니다
    notion_token = os.environ.get("NOTION_API_KEY")
    
    # 2. 오늘 날짜를 기반으로 시스템 시간축 날짜와 사람용 태그를 만듭니다
    now = datetime.now()
    month_label = now.strftime("%Y년 %m월")  # 사람 보기용 (예: 2026년 05월)
    month_date = now.strftime("%Y-%m-01")   # 시스템 계산용 (예: 2026-05-01)
    
    # 3. 노션 데이터베이스 고유 식별 주소 (ID)
    student_db_id = "3698fb930ae7812da2c8c34be1130655"
    invoice_db_id = "36b8fb930ae781c59a35d1e5ce2753f3"
    
    headers = {
        "Authorization": f"Bearer {notion_token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    # [단계 A] 학생 마스터 DB에서 '재원' 중인 학생 목록을 쿼리합니다
    query_url = f"https://api.notion.com/v1/databases/{student_db_id}/query"
    query_data = {
        "filter": {
            "property": "상태",
            "select": {
                "equals": "재원"
            }
        }
    }
    
    response = requests.post(query_url, headers=headers, json=query_data)
    students = response.json().get("results", [])
    
    # [단계 B] 재원생 명단을 돌면서 [시스템] ERP_시간축을 포함한 새 청구서를 주입합니다
    create_url = "https://api.notion.com/v1/pages"
    
    for student in students:
        # 학생의 이름을 안전하게 추출합니다
        name_properties = student["properties"]["이름"]["title"]
        if not name_properties:
            continue
        student_name = name_properties[0]["text"]["content"]
        student_page_id = student["id"]
        
        # 챗GPT와 조율한 완벽한 규격의 대기업급 ERP 데이터 구조입니다
        payload = {
            "parent": {"database_id": invoice_db_id},
            "properties": {
                "청구서 명찰": {
                    "title": [{"text": {"content": f"{now.strftime('%Y-%m')} {student_name} 수강료"}}]
                },
                "[확인] 수강생 이름": {
                    "relation": [{"id": student_page_id}]
                },
                "[확인] 청구월 태그": {
                    "select": {"name": month_label}
                },
                "[수동] 결제 수단": {
                    "select": {"name": "카드 결제"}
                },
                "[수동] 입금 완료 단추": {
                    "checkbox": False
                },
                # 원장 선생님이 새로 만드신 무적의 시간축 엔진 칸입니다!
                "[시스템] ERP_시간축": {
                    "date": {"start": month_date}
                }
            }
        }
        
        # 노션 장부에 최종 전송 및 삽입합니다
        requests.post(create_url, headers=headers, json=payload)
        
    return {"statusCode": 200, "body": "YES English ERP 자동 정산 완료"}
