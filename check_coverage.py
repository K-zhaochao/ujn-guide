"""分析搜索索引覆盖情况"""
import json
import re

with open('f:\\CodeAritist\\Web\\ujn-guide\\site\\search\\search_index.json', encoding='utf-8') as f:
    data = json.load(f)

# 统计每个词的出现方式
for phrase in ['济南大学', '舜耕', '推优', '食堂', '创新创业', '奖学金', '转专业']:
    standalone = 0
    total = 0
    examples = []
    for d in data['docs']:
        t = d.get('text', '')
        if phrase in t:
            total += 1
            if re.search(r'(?:^|\s)' + re.escape(phrase) + r'(?=\s|$)', t):
                standalone += 1
            else:
                if len(examples) < 3:
                    idx = t.find(phrase)
                    ctx = t[max(0, idx-15):idx+len(phrase)+15]
                    examples.append('  [%s] ctx=%s' % (d['location'][:60], repr(ctx)))
    if total > standalone:
        print('%s: %d/%d standalone' % (phrase, standalone, total))
        for ex in examples:
            print(ex)
        print()
