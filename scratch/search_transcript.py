# -*- coding: utf-8 -*-
import json
import os

transcript_path = r"C:\Users\chichi\.gemini\antigravity\brain\0f672fce-477b-4b54-98be-be198536a007\.system_generated\logs\transcript.jsonl"

if os.path.exists(transcript_path):
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                content = data.get("content", "")
                if "5점" in content or "로컬" in content:
                    # 사용자 메시지이거나 AI 응답일 때
                    source = data.get("source", "")
                    step = data.get("step_index", "")
                    print(f"[{source}] Step {step}: {content[:300]}...")
                    print("-" * 50)
            except Exception as e:
                pass
else:
    print("Transcript not found")
