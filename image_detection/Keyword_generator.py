import easyocr
from collections import Counter

reader = easyocr.Reader(['en'])

result = reader.readtext('C:\\Users\\vedan\\Downloads\\MediClarity\\server\\Images\\myfile.png')

keywords = []
for detection in result:
    text = detection[1]
    words = [word.lower() for word in text.split() if len(word) > 2]
    keywords.extend(words)

keyword_counts = Counter(keywords)
keywords_list=[]

for keyword, count in keyword_counts.items():
    keywords_list.append(keyword)
