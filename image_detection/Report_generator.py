from openai import OpenAI
from Keyword_generator import keywords_list

client = OpenAI(api_key="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")

prompt = ""
for keywords in keywords_list:
    prompt += keywords + "\n"

prompt += "generate a medical report over this and also give the definition of all the biological terms used in the report please also add what will happen if values are out of given range"

response = client.chat.completions.create(
    model = "gpt-3.5-turbo",
    temperature = 0,
    messages = [
        {
            "role": "system",
            "content": "generate a medical report over this and also give the definition of all the biological terms used in the report please also add what will happen if values are out of given range"
        },
        {
            "role": "user",
            "content": prompt
        }
    ]
)

print(response.choices[0].message.content)