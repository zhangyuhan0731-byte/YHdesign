import re

b = open('C:/Users/zhang/Desktop/YHdesign/tools/ledger_b64.txt').read().strip()
uri = 'url("data:image/png;base64,' + b + '")'
newcss = '.ic-ledger { background-image: ' + uri + '; background-size: contain; }'

p = 'C:/Users/zhang/Desktop/YHdesign/app.wxss'
s = open(p, encoding='utf-8').read()

# remove existing comment + .ic-ledger rule
s = re.sub(r'(?m)^\/\* 记账本图标[^\n]*\n', '', s)
s2 = re.sub(r'(?m)^\s*\.ic-ledger \{[^}]*\}\s*\n?', newcss + '\n', s, count=1)
assert s2 != s, 'no replacement made'
open(p, 'w', encoding='utf-8').write(s2)
print('done, newcss len', len(newcss))
