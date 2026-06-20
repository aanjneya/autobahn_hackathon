import glob
import re

for filename in glob.glob('frontend/ui/index*.html'):
    with open(filename, 'r') as f:
        content = f.read()
    
    # 1. Extract the <select> block
    select_match = re.search(r'(\s*<select class="mode-select".*?</select>\n)', content, re.DOTALL)
    if not select_match:
        print(f"Select not found in {filename}")
        continue
    select_block = select_match.group(1)
    
    # 2. Remove the select block from its original place (inside hdr__text)
    content = content.replace(select_block, '')
    
    # 3. Restructure hdr__right
    # Current hdr__right:
    #       <div class="hdr__right">
    #         <button class="print-btn" id="printBtn" title="Drucken">🖨️ Drucken</button>
    #         <img class="hdr__logo" src="..." alt="Die Autobahn">
    #       </div>
    
    # Replace it with the new structure
    old_hdr_right = r'''      <div class="hdr__right">
        <button class="print-btn" id="printBtn" title="Drucken">🖨️ Drucken</button>
        <img class="hdr__logo" src="https://www.autobahn.de/_assets/4483a80560873394161ba712d6ca7e9e/Images/Logo.svg" alt="Die Autobahn">
      </div>'''
      
    new_hdr_right = f'''      <div class="hdr__right">
        <div style="display: flex; gap: 14px; align-items: center;">
          <button class="print-btn" id="printBtn" title="Drucken">🖨️ Drucken</button>
          <img class="hdr__logo" src="https://www.autobahn.de/_assets/4483a80560873394161ba712d6ca7e9e/Images/Logo.svg" alt="Die Autobahn">
        </div>{select_block}      </div>'''
        
    content = content.replace(old_hdr_right, new_hdr_right)
    
    with open(filename, 'w') as f:
        f.write(content)

print("Updated HTML files.")
