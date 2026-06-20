import re
import glob

def refactor_app_js(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Update `render()` to call Sidebar functions
    content = content.replace(
        "const mini = document.getElementById('miniList') || document.getElementById('calMini');\n  mini.innerHTML = '';\n  if (mC) mini.appendChild(renderMini(mC.y, mC.m));\n  if (mD) mini.appendChild(renderMini(mD.y, mD.m));\n\n  updateMapRoutes();",
        "Sidebar.render(mC, mD, state, lookup);"
    )
    # Also handle the tourist version of render()
    content = content.replace(
        "const mini = document.getElementById('calMini');\n  mini.innerHTML = '';\n  if (mC) mini.appendChild(renderMini(mC.y, mC.m));\n  if (mD) mini.appendChild(renderMini(mD.y, mD.m));",
        "Sidebar.render(mC, mD, state, lookup);"
    )

    # 2. Update `renderDetail` map color calls
    content = content.replace(
        "tr.addEventListener('mouseenter', () => updateMapColor(worst, ds));\n    tr.addEventListener('mouseleave', () => updateMapColor(0, null));",
        "tr.addEventListener('mouseenter', () => Sidebar.updateMapColor(worst, state));\n    tr.addEventListener('mouseleave', () => Sidebar.updateMapColor(0, state));"
    )

    # 3. Remove `renderMini`
    content = re.sub(r'function renderMini\(year, month\) \{.*?\n\}\n', '', content, flags=re.DOTALL)

    # 4. Remove Map logic
    content = re.sub(r'// ────────────────────────────────────────────────────────────\n// Leaflet-Karte.*?function updateMapColor\(cat, _ds\) \{.*?\}\n', '', content, flags=re.DOTALL)

    with open(filepath, 'w') as f:
        f.write(content)

for js_file in glob.glob('frontend/ui/app*.js'):
    refactor_app_js(js_file)

print("Done")
