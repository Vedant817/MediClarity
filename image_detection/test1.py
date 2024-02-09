import csv

# Open the file containing the string data
with open('C:\\Users\\akshi\\MediClarity\\image_detection\\data.txt', 'r') as file:
    string_data = file.read()
    print(string_data)

# Replace spaces with commas
string_data_csv = string_data.replace(' ', ',')

# Split the string data into rows
rows = string_data_csv.strip().split('\n')

# Open a CSV file in write mode
with open('output.csv', 'w', newline='') as csvfile:
    # Create a CSV writer object
    csv_writer = csv.writer(csvfile)
    
    # Write rows to the CSV file
    for row in rows:
        csv_writer.writerow(row.split(','))