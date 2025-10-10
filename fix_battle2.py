# -*- coding: utf-8 -*-

# 파일 읽기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 잘못된 이스케이프 수정
content = content.replace(
    "setSelectedRegion(\\'우리학교\\');",
    "setSelectedRegion('우리학교');"
)

# 파일 쓰기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("이스케이프 문자 수정 완료!")
