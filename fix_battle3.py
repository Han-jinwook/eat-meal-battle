# -*- coding: utf-8 -*-

# 파일 읽기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# region 필드 추가
content = content.replace(
    """schoolMode.selectInterestSchool({
                                  id: school.id,
                                  school_name: school.school_name,
                                  school_code: school.school_code,
                                  office_code: school.office_code,
                                  created_at: school.created_at
                                });""",
    """schoolMode.selectInterestSchool({
                                  id: school.id,
                                  school_name: school.school_name,
                                  school_code: school.school_code,
                                  office_code: school.office_code,
                                  region: school.region,
                                  created_at: school.created_at
                                });"""
)

# 파일 쓰기
with open('d:\\WhatEat\\src\\app\\battle\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("region 필드 추가 완료!")
