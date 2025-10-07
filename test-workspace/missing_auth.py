from flask import Flask, request
from flask_login import login_required

app = Flask(__name__)

# ❌ TEST 1: Should TRIGGER warning (no auth)
@app.route("/admin")
def admin_panel():
    return "Sensitive admin panel"

# ✅ TEST 2: Should NOT trigger (has @login_required BEFORE @app.route)
@login_required
@app.route("/profile")
def user_profile():
    return "User Profile"

# ❌ TEST 3: Should TRIGGER warning (no auth on sensitive endpoint)
@app.route("/delete_account")
def delete_account():
    user_id = request.args.get('id')
    return f"Deleted account {user_id}"

# ✅ TEST 4: Should NOT trigger (has @login_required)
@login_required
@app.route("/settings")
def user_settings():
    return "User Settings"

# ❌ TEST 5: Should TRIGGER warning (public endpoint that might need auth)
@app.route("/api/data")
def api_data():
    return {"data": "sensitive information"}

# ✅ TEST 6: Public endpoint (typically login doesn't need auth - but rule will still flag it)
@app.route("/login")
def login():
    return "Login page"

# ❌ TEST 7: Should TRIGGER warning (multi-line function)
@app.route("/dashboard")
def dashboard():
    data = get_user_data()
    analytics = get_analytics()
    return render_dashboard(data, analytics)