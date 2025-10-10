# -*- coding: utf-8 -*-

# 파일 읽기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 학교명 약식 변환 함수 추가 (getSchoolCharacterImage 함수 바로 아래에 추가)
function_to_add = """
// 학교명 약식 변환 함수 (예: 가림고등학교 -> 가림고)
const getShortSchoolName = (schoolName: string): string => {
  if (!schoolName) return '';
  return schoolName
    .replace(/고등학교$/, '고')
    .replace(/중학교$/, '중')
    .replace(/초등학교$/, '초');
};
"""

# getSchoolCharacterImage 함수 다음에 추가
content = content.replace(
    "export default function BattlePage() {",
    function_to_add + "\nexport default function BattlePage() {"
)

# 2. 메뉴배틀 섹션의 "우리학교" 버튼 텍스트 변경
content = content.replace(
    """                        >
                          우리학교
                        </button>""",
    """                        >
                          {getShortSchoolName(currentSchool.school_name)}
                        </button>"""
)

# 파일 쓰기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("학교명 약식 표시 수정 완료!")
