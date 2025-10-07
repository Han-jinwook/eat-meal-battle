# -*- coding: utf-8 -*-
import re

# 파일 읽기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. "내 학교로 돌아가기" 수정
content = content.replace(
    "schoolMode.returnToMySchool();\n                        setIsDropdownOpen(false);",
    "schoolMode.returnToMySchool();\n                        setSelectedRegion('우리학교');\n                        setIsDropdownOpen(false);"
)

# 2. "관심학교 선택" 수정
content = re.sub(
    r'(schoolMode\.selectInterestSchool\(\{[\s\S]*?\}\);)\n(\s+)(setIsDropdownOpen\(false\);)',
    r'\1\n\2setSelectedRegion(\'우리학교\');\n\2\3',
    content
)

# 파일 쓰기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("수정 완료!")
