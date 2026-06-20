import os
import re

modes = [
    ("index.html", "app.js", "Mode: Standard / Base"),
    ("index_tourist.html", "app_tourist.js", "1. Private Traveler / Tourist"),
    ("index_resident.html", "app_resident.js", "2. Local Resident"),
    ("index_logistics.html", "app_logistics.js", "3. Logistics / Freight / Bus"),
    ("index_tourism.html", "app_tourism.js", "4. Tourism Business"),
    ("index_authority.html", "app_authority.js", "5. Traffic Management Authority")
]

with open("frontend/ui/index.html", "r") as f:
    html = f.read()

# Create the select dropdown snippet template
def make_dropdown(current_html):
    options = []
    for h, j, name in modes:
        sel = ' selected' if h == current_html else ''
        options.append(f'          <option value="{h}"{sel}>{name}</option>')
    opts_str = '\n'.join(options)
    return f"""      <div class="hdr__text">
        <select class="mode-select" onchange="window.location.href=this.value">
{opts_str}
        </select>"""

for h, j, name in modes:
    new_html = html
    # 1. Inject dropdown before hdr__title
    new_html = re.sub(r'      <div class="hdr__text">', make_dropdown(h), new_html)
    # 2. Update script src
    new_html = re.sub(r'<script src="app.js[^>]*></script>', f'<script src="{j}"></script>', new_html)
    
    with open(f"frontend/ui/{h}", "w") as f:
        f.write(new_html)

print("Generated all HTML files.")
