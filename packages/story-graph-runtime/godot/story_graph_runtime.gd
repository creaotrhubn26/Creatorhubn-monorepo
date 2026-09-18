## story_graph_runtime.gd — minimal runtime for Story Graph exports (Arcweave-compatible
## project.json) in Godot 4 (GDScript, no addons).
##
## Scope (documented subset of arcscript — see packages/story-graph-runtime/README.md):
##   assignment  = += -= *= /= %=          literals   int, float, bool, 'str' / "str"
##   if / elseif / else / endif around prose (one statement per line inside <pre><code>)
##   comparison  == != < > <= >=  is / is not     logic  and && or || not !
##   arithmetic  + - * / %  unary - +               functions  visits([ref]) abs min max round sqr sqrt random roll
##   references  @[id-or-customId] (element visits) / @[variable-id]
## Not supported (warning, no-op): show(), reset(), resetAll(), resetVisits(), component-scoped
## attributes as variables. For full arcscript use Arcweave's own MIT plugins with the same JSON.
##
## Usage:
##   var project := StoryGraphRuntime.Project.load_json(FileAccess.get_file_as_string("res://story.json"))
##   var session := StoryGraphRuntime.Session.new(project)
##   var view := session.start()             # view.text, view.options[i].label_text, view.dead_end
##   view = session.choose(view.options[0].connection_id)
##
## Parity check: StoryGraphRuntime.transcript(project) must equal fixtures/sample-project.expected.txt
## for fixtures/sample-project.json (see CHECKLIST.md).
class_name StoryGraphRuntime
extends RefCounted


# ─────────────────────────────────────────────────────────────────── model

class Element:
	var id: String
	var custom_id: String = ""
	var title_html: String = ""
	var content_html: String = ""
	var outputs: Array[String] = []
	var components: Array[String] = []
	func title_text() -> String:
		return Html.to_plain_text(title_html)


class Branch:
	var id: String
	var if_condition: String = ""
	var else_if_conditions: Array[String] = []
	var else_condition: String = ""


class Condition:
	var id: String
	var script: String = ""   # "" = else / unconditional
	var has_script: bool = false
	var output: String = ""


class Jumper:
	var id: String
	var element_id: String = ""


class Connection:
	var id: String
	var source_id: String = ""
	var target_id: String = ""
	var label_html: String = ""


class Variable:
	var id: String
	var name: String
	var type: String = "string"   # integer | float | boolean | string
	var default_value: Variant = null


class Project:
	var name: String = ""
	var starting_element: String = ""
	var elements: Dictionary = {}      # id → Element
	var branches: Dictionary = {}      # id → Branch
	var jumpers: Dictionary = {}       # id → Jumper
	var connections: Dictionary = {}   # id → Connection
	var conditions: Dictionary = {}    # id → Condition
	var variables: Array[Variable] = []
	var component_names: Dictionary = {}
	var warnings: Array[String] = []

	static func load_json(json_text: String) -> Project:
		var parsed = JSON.parse_string(json_text)
		if typeof(parsed) != TYPE_DICTIONARY:
			push_error("StoryGraphRuntime: project.json could not be parsed")
			return null
		return from_dict(parsed)

	static func from_dict(root: Dictionary) -> Project:
		var p := Project.new()
		p.name = str(root.get("name", ""))
		p.starting_element = str(root.get("startingElement", "")) if root.get("startingElement") != null else ""
		for id in _entries(root.get("elements")):
			var o: Dictionary = root["elements"][id]
			var e := Element.new()
			e.id = id
			e.custom_id = str(o.get("customId", "")) if o.get("customId") != null else ""
			e.title_html = str(o.get("title", ""))
			e.content_html = str(o.get("content", ""))
			for s in _strings(o.get("outputs")): e.outputs.append(s)
			for s in _strings(o.get("components")): e.components.append(s)
			p.elements[id] = e
		for id in _entries(root.get("branches")):
			var o: Dictionary = root["branches"][id]
			var c = o.get("conditions")
			var b := Branch.new()
			b.id = id
			if typeof(c) == TYPE_DICTIONARY:
				b.if_condition = str(c.get("ifCondition", "")) if c.get("ifCondition") != null else ""
				b.else_condition = str(c.get("elseCondition", "")) if c.get("elseCondition") != null else ""
				for s in _strings(c.get("elseIfConditions")): b.else_if_conditions.append(s)
			p.branches[id] = b
		for id in _entries(root.get("jumpers")):
			var j := Jumper.new()
			j.id = id
			var target = root["jumpers"][id].get("elementId")
			j.element_id = str(target) if target != null else ""
			p.jumpers[id] = j
		for id in _entries(root.get("connections")):
			var o: Dictionary = root["connections"][id]
			var k := Connection.new()
			k.id = id
			k.source_id = str(o.get("sourceid", ""))
			k.target_id = str(o.get("targetid", ""))
			k.label_html = str(o.get("label", "")) if o.get("label") != null else ""
			p.connections[id] = k
		for id in _entries(root.get("conditions")):
			var o: Dictionary = root["conditions"][id]
			var c := Condition.new()
			c.id = id
			c.has_script = o.has("script") and o["script"] != null and str(o["script"]).strip_edges() != ""
			c.script = str(o["script"]) if c.has_script else ""
			c.output = str(o.get("output", "")) if o.get("output") != null else ""
			p.conditions[id] = c
		for id in _entries(root.get("variables")):
			var o: Dictionary = root["variables"][id]
			if o.has("children"):
				continue
			var v := Variable.new()
			v.id = id
			v.name = str(o.get("name", id))
			v.type = str(o.get("type", "string"))
			v.default_value = o.get("value")
			p.variables.append(v)
		for id in _entries(root.get("components")):
			var o: Dictionary = root["components"][id]
			if o.has("children"):
				continue
			p.component_names[id] = str(o.get("name", id))
		var attrs = root.get("attributes")
		if typeof(attrs) == TYPE_DICTIONARY:
			for aid in attrs:
				if typeof(attrs[aid]) == TYPE_DICTIONARY and attrs[aid].get("cType") == "components":
					p.warnings.append("Component attributes are not exposed as variables in this runtime (use the JS package or Arcweave's plugins).")
					break
		return p

	static func _entries(t) -> Array:
		var out: Array = []
		if typeof(t) != TYPE_DICTIONARY:
			return out
		for k in t:
			if typeof(t[k]) == TYPE_DICTIONARY:
				out.append(str(k))
		return out

	static func _strings(t) -> Array:
		var out: Array = []
		if typeof(t) != TYPE_ARRAY:
			return out
		for x in t:
			if typeof(x) == TYPE_STRING:
				out.append(x)
		return out

	## Resolve an element by id or customId (prefix like "nel_" tolerated). Returns null if unknown.
	func find_element(reference: String) -> Element:
		if reference == "":
			return null
		if elements.has(reference):
			return elements[reference]
		var re := RegEx.new()
		re.compile("^[a-z]{3}_")
		var stripped := re.sub(reference, "")
		if stripped != reference and elements.has(stripped):
			return elements[stripped]
		for e in elements.values():
			if e.custom_id != "" and e.custom_id == reference:
				return e
		return null


# ─────────────────────────────────────────────────────────────────── html

class Html:
	const ENTITIES := {
		"amp": "&", "lt": "<", "gt": ">", "quot": "\"", "apos": "'", "nbsp": " ",
		"aring": "å", "Aring": "Å", "aelig": "æ", "AElig": "Æ", "oslash": "ø", "Oslash": "Ø",
		"eacute": "é", "egrave": "è", "uuml": "ü", "ouml": "ö", "auml": "ä", "ndash": "–", "mdash": "—", "hellip": "…", "laquo": "«", "raquo": "»",
	}

	static func _re(pattern: String) -> RegEx:
		var r := RegEx.new()
		r.compile(pattern)
		return r

	## Element HTML → ordered segments [{code: bool, text: String}] (code: mentions → @[id], entities decoded).
	static func split_segments(html: String) -> Array:
		var out: Array = []
		if html == "":
			return out
		var code_re := _re("(?i)<pre(?:\\s[^>]*)?>\\s*<code(?:\\s[^>]*)?>([\\s\\S]*?)</code>\\s*</pre>")
		var last := 0
		for m in code_re.search_all(html):
			if m.get_start() > last:
				var chunk := html.substr(last, m.get_start() - last)
				if chunk.strip_edges() != "":
					out.append({"code": false, "text": chunk})
			out.append({"code": true, "text": _prepare_code(m.get_string(1))})
			last = m.get_end()
		if last < html.length():
			var chunk := html.substr(last)
			if chunk.strip_edges() != "":
				out.append({"code": false, "text": chunk})
		return out

	static func strip_code_blocks(html: String) -> String:
		if html == "":
			return ""
		return _re("(?i)<pre(?:\\s[^>]*)?>\\s*<code(?:\\s[^>]*)?>[\\s\\S]*?</code>\\s*</pre>").sub(html, "", true)

	static func has_script(html: String) -> bool:
		return html != "" and _re("(?i)<pre(?:\\s[^>]*)?>\\s*<code(?:\\s[^>]*)?>").search(html) != null

	static func _prepare_code(inner: String) -> String:
		var mention_re := _re("(?i)<span([^>]*)>([\\s\\S]*?)</span>")
		var data_id_re := _re("(?i)data-id\\s*=\\s*\"([^\"]*)\"")
		var tag_re := _re("<[^>]+>")
		var code := ""
		var last := 0
		for m in mention_re.search_all(inner):
			code += inner.substr(last, m.get_start() - last)
			var idm := data_id_re.search(m.get_string(1))
			if idm != null and idm.get_string(1) != "":
				code += "@[" + idm.get_string(1) + "]"
			else:
				code += decode_entities(tag_re.sub(m.get_string(2), "", true))
			last = m.get_end()
		code += inner.substr(last)
		code = _re("(?i)<br\\s*/?>").sub(code, "\n", true)
		code = _re("(?i)</p>\\s*<p[^>]*>").sub(code, "\n", true)
		return decode_entities(tag_re.sub(code, "", true))

	## Mirror of the shared htmlToPlainText: paragraphs → newlines, tags stripped, entities decoded.
	static func to_plain_text(html: String) -> String:
		if html == "":
			return ""
		var t := _re("(?i)<br\\s*/?>").sub(html, "\n", true)
		t = _re("(?i)</(p|div|li|h[1-6]|blockquote|pre)>").sub(t, "\n", true)
		t = _re("(?i)<li[^>]*>").sub(t, "- ", true)
		t = _re("<[^>]+>").sub(t, "", true)
		t = decode_entities(t).replace("\u00a0", " ")
		var lines: Array = []
		var ws := _re("[ \\t]+")
		for line in t.split("\n"):
			lines.append(ws.sub(line, " ", true).strip_edges())
		t = "\n".join(lines)
		t = _re("\\n{3,}").sub(t, "\n\n", true)
		return t.strip_edges()

	static func decode_entities(s: String) -> String:
		if s.find("&") < 0:
			return s
		var re := _re("&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);")
		var out := ""
		var last := 0
		for m in re.search_all(s):
			out += s.substr(last, m.get_start() - last)
			var name := m.get_string(1)
			if name.begins_with("#x"):
				out += char(("0x" + name.substr(2)).hex_to_int())
			elif name.begins_with("#"):
				out += char(int(name.substr(1)))
			elif ENTITIES.has(name):
				out += ENTITIES[name]
			else:
				out += m.get_string(0)
			last = m.get_end()
		return out + s.substr(last)


# ─────────────────────────────────────────────────────────────────── values

class Value:
	static func truthy(v) -> bool:
		match typeof(v):
			TYPE_BOOL: return v
			TYPE_INT, TYPE_FLOAT: return v != 0
			TYPE_STRING: return v.length() > 0
		return v != null

	static func num(v) -> float:
		match typeof(v):
			TYPE_BOOL: return 1.0 if v else 0.0
			TYPE_INT, TYPE_FLOAT: return float(v)
			TYPE_STRING: return float(v) if v.is_valid_float() else 0.0
		return 0.0

	static func format(d: float) -> String:
		if absf(d - roundf(d)) < 1e-9:
			return str(int(roundf(d)))
		return str(snappedf(d, 0.001))

	static func to_str(v) -> String:
		match typeof(v):
			TYPE_STRING: return v
			TYPE_BOOL: return "true" if v else "false"
			TYPE_INT, TYPE_FLOAT: return format(float(v))
		return ""

	static func coerce(type: String, v):
		match type:
			"boolean", "bool": return truthy(v)
			"integer", "int": return float(int(num(v)))
			"float": return num(v)
		return to_str(v)

	static func equal(a, b) -> bool:
		if typeof(a) == TYPE_BOOL or typeof(b) == TYPE_BOOL:
			return truthy(a) == truthy(b)
		if typeof(a) == TYPE_STRING and typeof(b) == TYPE_STRING:
			return a == b
		if typeof(a) == TYPE_STRING or typeof(b) == TYPE_STRING:
			var sa: String = a if typeof(a) == TYPE_STRING else ""
			var sb: String = b if typeof(b) == TYPE_STRING else ""
			var a_num := typeof(a) != TYPE_STRING or sa.is_valid_float()
			var b_num := typeof(b) != TYPE_STRING or sb.is_valid_float()
			if a_num and b_num:
				return absf(num(a) - num(b)) < 1e-9
			return to_str(a) == to_str(b)
		return absf(num(a) - num(b)) < 1e-9


# ─────────────────────────────────────────────────────────────────── script (subset)

class Interp:
	const KEYWORDS := ["if", "elseif", "else", "endif", "is", "not", "and", "or", "true", "false"]
	const OPS := ["==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "&&", "||", "<", ">", "=", "+", "-", "*", "/", "%", "!", "(", ")", ","]

	var variables: Dictionary = {}          # name → value
	var variable_types: Dictionary = {}     # name → type
	var variable_id_to_name: Dictionary = {}
	var visits: Dictionary = {}             # element id → int
	var current_element_id: String = ""
	var warnings: Array[String] = []
	var rng: Callable = func() -> float: return 0.5
	var resolve_element: Callable = func(_r: String) -> String: return ""

	var _toks: Array = []
	var _pos: int = 0
	var _err: String = ""

	func visits_of(element_id: String) -> int:
		return int(visits.get(element_id, 0)) if element_id != "" else 0

	# ── tokenizer: tokens are {t: "num"|"str"|"id"|"mention"|"op"|"kw"|"end", v: ...}
	func _tokenize(src: String) -> Array:
		var out: Array = []
		var i := 0
		var n := src.length()
		while i < n:
			var c := src[i]
			if c == " " or c == "\t" or c == "\r" or c == "\n":
				i += 1
				continue
			if c == "@" and i + 1 < n and src[i + 1] == "[":
				var close := src.find("]", i)
				if close < 0:
					_err = "Unterminated @[ reference"
					return out
				out.append({"t": "mention", "v": src.substr(i + 2, close - i - 2).strip_edges()})
				i = close + 1
				continue
			if _is_digit(c) or (c == "." and i + 1 < n and _is_digit(src[i + 1])):
				var s := i
				while i < n and (_is_digit(src[i]) or src[i] == "."):
					i += 1
				out.append({"t": "num", "v": float(src.substr(s, i - s))})
				continue
			if c == "'" or c == "\"":
				i += 1
				var buf := ""
				while i < n and src[i] != c:
					if src[i] == "\\" and i + 1 < n:
						i += 1
					buf += src[i]
					i += 1
				i += 1
				out.append({"t": "str", "v": buf})
				continue
			if _is_alpha(c) or c == "_" or c == "$":
				var s := i
				while i < n and (_is_alpha(src[i]) or _is_digit(src[i]) or src[i] == "_" or src[i] == "$" or src[i] == "."):
					i += 1
				var word := src.substr(s, i - s).lstrip("$")
				out.append({"t": "kw" if word in KEYWORDS else "id", "v": word})
				continue
			var matched := ""
			for op in OPS:
				if src.substr(i, op.length()) == op:
					matched = op
					break
			if matched == "":
				_err = "Unexpected character '%s'" % c
				return out
			out.append({"t": "op", "v": matched})
			i += matched.length()
		out.append({"t": "end", "v": ""})
		return out

	static func _is_digit(c: String) -> bool:
		return c >= "0" and c <= "9"

	static func _is_alpha(c: String) -> bool:
		return (c >= "a" and c <= "z") or (c >= "A" and c <= "Z") or c.unicode_at(0) > 127

	func _peek() -> Dictionary:
		return _toks[_pos]
	func _is_op(s: String) -> bool:
		return _peek()["t"] == "op" and _peek()["v"] == s
	func _is_kw(s: String) -> bool:
		return _peek()["t"] == "kw" and _peek()["v"] == s
	func _next() -> Dictionary:
		_pos += 1
		return _toks[_pos - 1]
	func _expect(op: String) -> void:
		if not _is_op(op):
			_err = "Expected '%s'" % op
		else:
			_pos += 1

	# ── public API
	func evaluate_condition(script_text: String) -> bool:
		if script_text.strip_edges() == "":
			return true
		_err = ""
		_toks = _tokenize(script_text)
		_pos = 0
		var v = _or() if _err == "" else false
		if _err != "":
			warnings.append("Condition error: %s in '%s'" % [_err, script_text])
			return false
		return Value.truthy(v)

	## Run element/label HTML: executes code segments, returns the active prose HTML.
	func run_html(html: String) -> String:
		var frames: Array = []   # [{parent, active, taken}]
		var output := ""
		for seg in Html.split_segments(html):
			if not seg["code"]:
				if frames.is_empty() or frames[-1]["active"]:
					output += seg["text"]
				continue
			for raw in seg["text"].split("\n"):
				var line: String = raw.strip_edges()
				if line == "" or line.begins_with("//"):
					continue
				_err = ""
				_toks = _tokenize(line)
				_pos = 0
				if _err == "":
					var active: bool = frames.is_empty() or frames[-1]["active"]
					if _is_kw("if"):
						_pos += 1
						var on := active and Value.truthy(_or())
						frames.append({"parent": active, "active": on, "taken": on})
					elif _is_kw("elseif"):
						_pos += 1
						if frames.is_empty():
							_err = "elseif without if"
						else:
							var f: Dictionary = frames[-1]
							if f["taken"]:
								f["active"] = false
							else:
								f["active"] = f["parent"] and Value.truthy(_or())
								f["taken"] = f["taken"] or f["active"]
					elif _is_kw("else"):
						_pos += 1
						if frames.is_empty():
							_err = "else without if"
						else:
							var f: Dictionary = frames[-1]
							f["active"] = f["parent"] and not f["taken"]
							f["taken"] = true
					elif _is_kw("endif"):
						_pos += 1
						if frames.is_empty():
							_err = "endif without if"
						else:
							frames.pop_back()
					elif active:
						_statement()
				if _err != "":
					warnings.append("Script error: %s in '%s'" % [_err, line])
		return output

	func _statement() -> void:
		var t0: Dictionary = _toks[_pos]
		var t1: Dictionary = _toks[_pos + 1]
		var is_assign: bool = t0["t"] == "id" and t1["t"] == "op" and (t1["v"] == "=" or (t1["v"].length() == 2 and t1["v"][1] == "=" and t1["v"][0] in ["+", "-", "*", "/", "%"]))
		if is_assign:
			var name: String = _next()["v"]
			var op: String = _next()["v"]
			var rhs = _or()
			if _err != "":
				return
			if not variables.has(name):
				_err = "Unknown variable '%s'" % name
				return
			var cur = variables[name]
			var val
			match op:
				"=": val = rhs
				"+=": val = (Value.to_str(cur) + Value.to_str(rhs)) if (typeof(cur) == TYPE_STRING or typeof(rhs) == TYPE_STRING) else Value.num(cur) + Value.num(rhs)
				"-=": val = Value.num(cur) - Value.num(rhs)
				"*=": val = Value.num(cur) * Value.num(rhs)
				"/=":
					if Value.num(rhs) == 0:
						_err = "Division by zero"
						return
					val = Value.num(cur) / Value.num(rhs)
				_:
					if Value.num(rhs) == 0:
						_err = "Modulo by zero"
						return
					val = fmod(Value.num(cur), Value.num(rhs))
			variables[name] = Value.coerce(variable_types[name], val)
			return
		_or()   # expression statement (function call) — value discarded

	# ── expression grammar (low → high): or, and, is/is not, == !=, < > <= >=, + -, * / %, unary, primary
	func _or():
		var l = _and()
		while _err == "" and (_is_kw("or") or _is_op("||")):
			_pos += 1
			var r = _and()
			l = Value.truthy(l) or Value.truthy(r)
		return l

	func _and():
		var l = _is_expr()
		while _err == "" and (_is_kw("and") or _is_op("&&")):
			_pos += 1
			var r = _is_expr()
			l = Value.truthy(l) and Value.truthy(r)
		return l

	func _is_expr():
		var l = _equality()
		while _err == "" and _is_kw("is"):
			_pos += 1
			var neg := _is_kw("not")
			if neg:
				_pos += 1
			var r = _equality()
			l = Value.equal(l, r) != neg
		return l

	func _equality():
		var l = _relational()
		while _err == "" and (_is_op("==") or _is_op("!=")):
			var op: String = _next()["v"]
			var r = _relational()
			l = Value.equal(l, r) == (op == "==")
		return l

	func _relational():
		var l = _additive()
		while _err == "" and (_is_op("<") or _is_op(">") or _is_op("<=") or _is_op(">=")):
			var op: String = _next()["v"]
			var a := Value.num(l)
			var b := Value.num(_additive())
			match op:
				"<": l = a < b
				">": l = a > b
				"<=": l = a <= b
				_: l = a >= b
		return l

	func _additive():
		var l = _multiplicative()
		while _err == "" and (_is_op("+") or _is_op("-")):
			var op: String = _next()["v"]
			var r = _multiplicative()
			if op == "+":
				l = (Value.to_str(l) + Value.to_str(r)) if (typeof(l) == TYPE_STRING or typeof(r) == TYPE_STRING) else Value.num(l) + Value.num(r)
			else:
				l = Value.num(l) - Value.num(r)
		return l

	func _multiplicative():
		var l = _unary()
		while _err == "" and (_is_op("*") or _is_op("/") or _is_op("%")):
			var op: String = _next()["v"]
			var a := Value.num(l)
			var b := Value.num(_unary())
			if op == "*":
				l = a * b
			elif b == 0:
				_err = "Division by zero" if op == "/" else "Modulo by zero"
				return 0.0
			else:
				l = a / b if op == "/" else fmod(a, b)
		return l

	func _unary():
		if _is_op("!") or _is_kw("not"):
			_pos += 1
			return not Value.truthy(_unary())
		if _is_op("-"):
			_pos += 1
			return -Value.num(_unary())
		if _is_op("+"):
			_pos += 1
			return Value.num(_unary())
		return _primary()

	func _primary():
		var t: Dictionary = _next()
		match t["t"]:
			"num": return t["v"]
			"str": return t["v"]
			"mention":
				if variable_id_to_name.has(t["v"]) and variables.has(variable_id_to_name[t["v"]]):
					return variables[variable_id_to_name[t["v"]]]
				if variables.has(t["v"]):
					return variables[t["v"]]
				var resolved: String = resolve_element.call(t["v"])
				return resolved if resolved != "" else t["v"]
			"kw":
				if t["v"] == "true":
					return true
				if t["v"] == "false":
					return false
				_err = "Unexpected keyword '%s'" % t["v"]
				return false
			"id":
				if _is_op("("):
					return _call(t["v"])
				if variables.has(t["v"]):
					return variables[t["v"]]
				_err = "Unknown identifier '%s'" % t["v"]
				return 0.0
			"op":
				if t["v"] == "(":
					var v = _or()
					_expect(")")
					return v
		_err = "Unexpected token"
		return 0.0

	func _call(name: String):
		_expect("(")
		var values: Array = []
		var refs: Array = []
		while _err == "" and not _is_op(")"):
			var p := _peek()
			if p["t"] == "mention":
				_pos += 1
				refs.append(p["v"])
				values.append(p["v"])
			elif p["t"] == "id" and not (_toks[_pos + 1]["t"] == "op" and _toks[_pos + 1]["v"] == "(") and not variables.has(p["v"]):
				_pos += 1
				refs.append(p["v"])
				values.append(p["v"])
			else:
				var v = _or()
				values.append(v)
				refs.append(v if typeof(v) == TYPE_STRING else "")
			if _is_op(","):
				_pos += 1
			else:
				break
		_expect(")")
		if _err != "":
			return 0.0
		var n0: float = Value.num(values[0]) if values.size() > 0 else 0.0
		var n1: float = Value.num(values[1]) if values.size() > 1 else 0.0
		match name:
			"visits":
				if values.is_empty():
					return float(visits_of(current_element_id))
				return float(visits_of(resolve_element.call(str(refs[0]))))
			"abs": return absf(n0)
			"sqr": return n0 * n0
			"sqrt":
				if n0 < 0:
					_err = "sqrt of negative"
					return 0.0
				return sqrt(n0)
			"round": return roundf(n0)
			"min":
				var m := n0
				for i in values.size():
					m = minf(m, Value.num(values[i]))
				return m
			"max":
				var m := n0
				for i in values.size():
					m = maxf(m, Value.num(values[i]))
				return m
			"random": return float(rng.call())
			"roll":
				var sides := maxi(1, int(floorf(n0)))
				var count := maxi(1, int(floorf(n1))) if values.size() > 1 else 1
				var sum := 0.0
				for i in count:
					sum += 1 + floorf(float(rng.call()) * sides)
				return sum
			"show", "reset", "resetAll", "resetVisits":
				warnings.append("Unsupported function '%s()' ignored (subset runtime)." % name)
				return 0.0
		_err = "Unknown function '%s'" % name
		return 0.0


# ─────────────────────────────────────────────────────────────────── session

class Option:
	var connection_id: String
	var target_id: String
	var label_html: String = ""
	func label_text() -> String:
		return Html.to_plain_text(label_html)


class View:
	var element_id: String
	var element: Element
	var html: String = ""              # rendered content (conditional sections applied, code removed)
	var options: Array[Option] = []
	var dead_end: bool = false
	var speaker_name: String = ""      # first attached component
	func text() -> String:
		return Html.to_plain_text(html)


class Session:
	var project: Project
	var script: Interp = Interp.new()
	var current: View = null
	var max_jumps: int = 100

	func _init(p: Project, rng: Callable = Callable(), jumps: int = 100) -> void:
		project = p
		max_jumps = jumps
		if rng.is_valid():
			script.rng = rng
		script.resolve_element = func(r: String) -> String:
			var e := project.find_element(r)
			return e.id if e != null else ""
		_reset_state()

	func warnings() -> Array[String]:
		return script.warnings

	func _reset_state() -> void:
		script.variables.clear()
		script.variable_types.clear()
		script.visits.clear()
		script.variable_id_to_name.clear()
		for v in project.variables:
			script.variable_types[v.name] = v.type
			script.variables[v.name] = Value.coerce(v.type, v.default_value)
			script.variable_id_to_name[v.id] = v.name

	func start() -> View:
		_reset_state()
		current = null
		var start_el := project.find_element(project.starting_element)
		if start_el == null and not project.elements.is_empty():
			start_el = project.elements.values()[0]
		if start_el == null:
			script.warnings.append("No starting element.")
			return null
		return _enter(start_el.id, 0)

	func restart() -> View:
		return start()

	func choose(connection_id: String) -> View:
		if current == null:
			return null
		var found := false
		for o in current.options:
			if o.connection_id == connection_id:
				found = true
		if not found or not project.connections.has(connection_id):
			return current
		var conn: Connection = project.connections[connection_id]
		if Html.has_script(conn.label_html):
			script.run_html(conn.label_html)
		return _enter(conn.target_id, 0)

	func get_variable(name: String):
		return script.variables.get(name)

	func set_variable(name: String, value) -> void:
		if not script.variable_types.has(name):
			script.warnings.append("Unknown variable '%s'" % name)
			return
		script.variables[name] = Value.coerce(script.variable_types[name], value)

	func visits_of(reference: String) -> int:
		var e := project.find_element(reference)
		return script.visits_of(e.id) if e != null else 0

	func _enter(id: String, depth: int) -> View:
		if depth > max_jumps:
			script.warnings.append("Stopped: more than %d consecutive jumps (loop?)." % max_jumps)
			current = _dead_end_view(id)
			return current
		script.current_element_id = id
		script.visits[id] = script.visits_of(id) + 1

		if project.jumpers.has(id):
			var target := project.find_element(project.jumpers[id].element_id)
			if target == null:
				current = _dead_end_view(id)
				return current
			return _enter(target.id, depth + 1)
		if project.branches.has(id):
			var b: Branch = project.branches[id]
			var order: Array = []
			if b.if_condition != "":
				order.append(b.if_condition)
			order.append_array(b.else_if_conditions)
			if b.else_condition != "":
				order.append(b.else_condition)
			for cid in order:
				if not project.conditions.has(cid):
					continue
				var cond: Condition = project.conditions[cid]
				var take := (not cond.has_script) or script.evaluate_condition(cond.script)
				if not take:
					continue
				if cond.output != "" and project.connections.has(cond.output) and project.connections[cond.output].target_id != "":
					return _enter(project.connections[cond.output].target_id, depth + 1)
				current = _dead_end_view(id)
				return current
			current = _dead_end_view(id)
			return current
		if not project.elements.has(id):
			script.warnings.append("Element '%s' does not exist." % id)
			return current

		var element: Element = project.elements[id]
		var view := View.new()
		view.element_id = id
		view.element = element
		view.html = script.run_html(element.content_html)
		for out_id in element.outputs:
			if not project.connections.has(out_id):
				continue
			var c: Connection = project.connections[out_id]
			if c.target_id == "" or not (project.elements.has(c.target_id) or project.branches.has(c.target_id) or project.jumpers.has(c.target_id)):
				continue
			var o := Option.new()
			o.connection_id = c.id
			o.target_id = c.target_id
			o.label_html = Html.strip_code_blocks(c.label_html)
			view.options.append(o)
		view.dead_end = view.options.is_empty()
		for cid in element.components:
			if project.component_names.has(cid):
				view.speaker_name = project.component_names[cid]
				break
		current = view
		return view

	func _dead_end_view(id: String) -> View:
		var v := View.new()
		v.element_id = id
		if project.elements.has(id):
			v.element = project.elements[id]
		else:
			v.element = Element.new()
			v.element.id = id
		v.dead_end = true
		return v


# ─────────────────────────────────────────────────────────────────── transcript (parity)

## Deterministic playthrough as text — same format as the JS package (`playTranscript`).
## `pick` is Callable(option_count: int, step: int) -> int (0-based); default = first option.
static func transcript(project: Project, max_steps: int = 12, pick: Callable = Callable()) -> String:
	var session := Session.new(project, func() -> float: return 0.5)
	var names: Array[String] = []
	for v in project.variables:
		names.append(v.name)
	names.sort()
	var lines: Array[String] = []
	var dump := func(view: View) -> void:
		if view == null:
			lines.append("(no view)")
			return
		var ident := view.element.custom_id.strip_edges() if view.element.custom_id.strip_edges() != "" else view.element_id
		lines.append("@ %s | %s" % [ident, view.element.title_text().strip_edges()])
		var text := view.text().strip_edges()
		if text != "":
			var parts: Array[String] = []
			for part in RegEx.create_from_string("\\s*\\n+\\s*").sub(text, "\n", true).split("\n"):
				if part != "":
					parts.append(part)
			lines.append("  " + " / ".join(parts))
		for i in view.options.size():
			lines.append("  %d) %s" % [i + 1, view.options[i].label_text().strip_edges()])
		if view.dead_end:
			lines.append("  (end)")
		var vars: Array[String] = []
		for n in names:
			vars.append("%s=%s" % [n, _format_var(session.get_variable(n))])
		lines.append("  vars: " + " ".join(vars))
	var view := session.start()
	dump.call(view)
	var step := 0
	while step < max_steps and view != null and not view.dead_end and not view.options.is_empty():
		var idx := 0
		if pick.is_valid():
			idx = clampi(int(pick.call(view.options.size(), step)), 0, view.options.size() - 1)
		lines.append("> choose %d" % (idx + 1))
		view = session.choose(view.options[idx].connection_id)
		dump.call(view)
		step += 1
	return "\n".join(lines) + "\n"


static func _format_var(v) -> String:
	match typeof(v):
		TYPE_BOOL: return "true" if v else "false"
		TYPE_INT, TYPE_FLOAT: return Value.format(float(v))
	return "\"" + str(v if v != null else "").replace("\\", "\\\\").replace("\"", "\\\"") + "\""
