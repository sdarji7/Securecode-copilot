import json
import sys
import re

try:
    data = json.loads(sys.argv[1])
    code = data["code"]
    issue = data["issueType"]
    
    print(f"Received request to fix: {issue}", file=sys.stderr)
    print(f"Original code:\n{code}", file=sys.stderr)
    
    fixed_code = code
    
    # Fix hardcoded secrets
    if "hardcoded secret" in issue.lower() or "hardcoded" in issue.lower():
        print("Applying hardcoded secret fix...", file=sys.stderr)
        
        # Replace common secret patterns
        fixed_code = re.sub(
            r'["\'](?:Bearer\s+)?[a-zA-Z0-9_\-]{20,}["\']',
            'os.getenv("API_KEY")',
            code
        )
        
        # Replace API_KEY assignments
        fixed_code = re.sub(
            r'API_KEY\s*=\s*["\'][^"\']+["\']',
            'API_KEY = os.getenv("API_KEY", "default_key")',
            fixed_code
        )
        
        # Replace SECRET assignments
        fixed_code = re.sub(
            r'SECRET\s*=\s*["\'][^"\']+["\']',
            'SECRET = os.getenv("SECRET", "default_secret")',
            fixed_code
        )
        
        # Replace password assignments
        fixed_code = re.sub(
            r'password\s*=\s*["\'][^"\']+["\']',
            'password = os.getenv("PASSWORD")',
            fixed_code,
            flags=re.IGNORECASE
        )
        
        # Add import os if not present
        if "import os" not in fixed_code and "os.getenv" in fixed_code:
            fixed_code = "import os\n\n" + fixed_code
    
    # Fix missing authorization
    elif "authorization" in issue.lower() or "auth" in issue.lower():
        print("Applying authorization fix...", file=sys.stderr)
        
        lines = code.split('\n')
        fixed_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Check if this line has @app.route or @route
            if '@app.route' in line or '@route' in line:
                # Check if @login_required already exists
                has_login_required = False
                
                # Look backwards for @login_required
                for j in range(i - 1, max(-1, i - 5), -1):
                    if j >= 0 and '@login_required' in lines[j]:
                        has_login_required = True
                        break
                
                if not has_login_required:
                    # Get the indentation from the @app.route line
                    indent = len(line) - len(line.lstrip())
                    decorator_line = ' ' * indent + '@login_required'
                    fixed_lines.append(decorator_line)
                    print(f"Adding decorator before line {i}: {decorator_line}", file=sys.stderr)
            
            fixed_lines.append(line)
            i += 1
        
        fixed_code = '\n'.join(fixed_lines)
        
        # Add import for login_required if not present
        if '@login_required' in fixed_code:
            # Check if import already exists
            has_flask_login_import = 'from flask_login import' in fixed_code
            has_login_required_import = 'login_required' in fixed_code.split('@login_required')[0]
            
            if not has_flask_login_import:
                # No flask_login import, add it
                fixed_code = "from flask_login import login_required\n" + fixed_code
                print("Added new flask_login import", file=sys.stderr)
            elif has_flask_login_import and not has_login_required_import:
                # Has flask_login import but not login_required, update it
                fixed_code = re.sub(
                    r'from flask_login import ([^\n]+)',
                    r'from flask_login import \1, login_required',
                    fixed_code,
                    count=1
                )
                print("Updated existing flask_login import", file=sys.stderr)
    
    # SQL Injection fix
    elif "sql injection" in issue.lower():
        print("Applying SQL injection fix...", file=sys.stderr)
        
        # Replace string formatting in SQL queries with parameterized queries
        fixed_code = re.sub(
            r'execute\(["\']SELECT \* FROM \w+ WHERE \w+ = ["\'] \+ (\w+) \+ ["\']["\']\)',
            r'execute("SELECT * FROM users WHERE username = ?", (\1,))',
            code
        )
        
        fixed_code = re.sub(
            r'execute\(f["\']SELECT \* FROM \w+ WHERE \w+ = {(\w+)}["\']\)',
            r'execute("SELECT * FROM users WHERE username = ?", (\1,))',
            fixed_code
        )
    
    # XSS fix
    elif "xss" in issue.lower() or "cross-site scripting" in issue.lower():
        print("Applying XSS fix...", file=sys.stderr)
        
        # Add HTML escaping
        if "return" in fixed_code and "<" in fixed_code:
            fixed_code = re.sub(
                r'return (["\'][^"\']*{\w+}[^"\']*["\'])',
                r'return escape(\1)',
                fixed_code
            )
            
            if "from markupsafe import escape" not in fixed_code:
                fixed_code = "from markupsafe import escape\n\n" + fixed_code
    
    print("Fixed code:\n{}", file=sys.stderr)
    print(fixed_code, file=sys.stderr)
    print("=" * 50, file=sys.stderr)
    print(fixed_code)
    
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)