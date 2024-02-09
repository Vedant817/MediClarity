import easyocr
from collections import Counter

# Initialize EasyOCR with desired language
reader = easyocr.Reader(['en'])

# Read the text from an image file
result = reader.readtext('C:\\Users\\akshi\\MediClarity\\image_detection\\image3.jpeg')  # Replace 'your_image.png' with the path to your image file

# Extract keywords from the detected text
keywords = []
for detection in result:
    text = detection[1]  # Extract the detected text
    # Split the text into words and filter out short words
    words = [word.lower() for word in text.split() if len(word) > 2]
    keywords.extend(words)

# Count the frequency of each keyword
keyword_counts = Counter(keywords)
keywords_list=[]

# Print the keywords and their frequencies
for keyword, count in keyword_counts.items():
    keywords_list.append(keyword)
    # print(f"{keyword}")
    # print(prompt)
