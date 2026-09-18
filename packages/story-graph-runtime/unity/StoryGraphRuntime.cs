// StoryGraphRuntime.cs — minimal runtime for Story Graph exports (Arcweave-compatible
// project.json) in Unity / .NET. Single file, depends only on Newtonsoft.Json
// (com.unity.nuget.newtonsoft-json, bundled with Unity 2020.3+).
//
// Scope (documented subset of arcscript — see packages/story-graph-runtime/README.md):
//   assignment  = += -= *= /= %=          literals   int, float, bool, 'str' / "str"
//   if / elseif / else / endif around prose (one statement per line inside <pre><code>)
//   comparison  == != < > <= >=  is / is not     logic  and && or || not !
//   arithmetic  + - * / %  unary - +               functions  visits([ref]) abs min max round sqr sqrt random roll
//   references  @[id-or-customId] (element visits) / @[variable-id]
// Not supported (warning, no-op): show(), reset(), resetAll(), resetVisits(), component-scoped
// attributes as variables. For full arcscript use Arcweave's own MIT plugins with the same JSON.
//
// Semantics mirror the shared TypeScript engine (frontend/shared/narrative-runtime):
//   enter element → visits++ → run content script → options = outputs
//   choose → run label script → enter target (jumper followed, branch auto-routed: first true
//   condition, else = condition without script; no hit → dead end)
//
// Parity check: StoryGraphTranscript.Play(project) must equal fixtures/sample-project.expected.txt
// for fixtures/sample-project.json (see CHECKLIST.md).

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace CreatorHub.StoryGraph
{
    // ─────────────────────────────────────────────────────────────────── model

    public sealed class StoryGraphElement
    {
        public string Id;
        public string CustomId;
        public string TitleHtml = "";
        public string ContentHtml = "";
        public readonly List<string> Outputs = new List<string>();
        public readonly List<string> Components = new List<string>();
        public string TitleText => StoryGraphHtml.ToPlainText(TitleHtml);
    }

    public sealed class StoryGraphBranch
    {
        public string Id;
        public string IfCondition;
        public readonly List<string> ElseIfConditions = new List<string>();
        public string ElseCondition;
    }

    public sealed class StoryGraphCondition { public string Id; public string Script; public string Output; }
    public sealed class StoryGraphJumper { public string Id; public string ElementId; }
    public sealed class StoryGraphConnection { public string Id; public string SourceId; public string TargetId; public string LabelHtml = ""; }

    public sealed class StoryGraphVariable
    {
        /// <summary>Key in project.json `variables` (what @[…] mentions refer to).</summary>
        public string Id;
        public string Name;
        /// <summary>integer | float | boolean | string (Arcweave type names).</summary>
        public string Type;
        public object DefaultValue;
    }

    public sealed class StoryGraphProject
    {
        public string Name = "";
        public string StartingElement;
        public readonly Dictionary<string, StoryGraphElement> Elements = new Dictionary<string, StoryGraphElement>();
        public readonly Dictionary<string, StoryGraphBranch> Branches = new Dictionary<string, StoryGraphBranch>();
        public readonly Dictionary<string, StoryGraphJumper> Jumpers = new Dictionary<string, StoryGraphJumper>();
        public readonly Dictionary<string, StoryGraphConnection> Connections = new Dictionary<string, StoryGraphConnection>();
        public readonly Dictionary<string, StoryGraphCondition> Conditions = new Dictionary<string, StoryGraphCondition>();
        /// <summary>Global variables in declaration order (folders skipped).</summary>
        public readonly List<StoryGraphVariable> Variables = new List<StoryGraphVariable>();
        public readonly Dictionary<string, string> ComponentNames = new Dictionary<string, string>();
        public readonly List<string> Warnings = new List<string>();

        public static StoryGraphProject Load(string json) => FromJObject(JObject.Parse(json));

        public static StoryGraphProject FromJObject(JObject root)
        {
            var p = new StoryGraphProject
            {
                Name = (string)root["name"] ?? "",
                StartingElement = (string)root["startingElement"],
            };
            foreach (var (id, o) in Entries(root["elements"]))
            {
                var e = new StoryGraphElement { Id = id, CustomId = (string)o["customId"], TitleHtml = (string)o["title"] ?? "", ContentHtml = (string)o["content"] ?? "" };
                foreach (var s in Strings(o["outputs"])) e.Outputs.Add(s);
                foreach (var s in Strings(o["components"])) e.Components.Add(s);
                p.Elements[id] = e;
            }
            foreach (var (id, o) in Entries(root["branches"]))
            {
                var c = o["conditions"] as JObject;
                var b = new StoryGraphBranch { Id = id, IfCondition = (string)c?["ifCondition"], ElseCondition = (string)c?["elseCondition"] };
                foreach (var s in Strings(c?["elseIfConditions"])) b.ElseIfConditions.Add(s);
                p.Branches[id] = b;
            }
            foreach (var (id, o) in Entries(root["jumpers"])) p.Jumpers[id] = new StoryGraphJumper { Id = id, ElementId = (string)o["elementId"] };
            foreach (var (id, o) in Entries(root["connections"]))
                p.Connections[id] = new StoryGraphConnection { Id = id, SourceId = (string)o["sourceid"], TargetId = (string)o["targetid"], LabelHtml = (string)o["label"] ?? "" };
            foreach (var (id, o) in Entries(root["conditions"]))
                p.Conditions[id] = new StoryGraphCondition { Id = id, Script = (string)o["script"], Output = (string)o["output"] };
            foreach (var (id, o) in Entries(root["variables"]))
            {
                if (o["children"] != null) continue; // folder
                p.Variables.Add(new StoryGraphVariable { Id = id, Name = (string)o["name"] ?? id, Type = (string)o["type"] ?? "string", DefaultValue = ((JValue)o["value"])?.Value });
            }
            foreach (var (id, o) in Entries(root["components"]))
            {
                if (o["children"] != null) continue;
                p.ComponentNames[id] = (string)o["name"] ?? id;
            }
            if (root["attributes"] is JObject attrs && attrs.Properties().Any(a => (string)a.Value["cType"] == "components"))
                p.Warnings.Add("Component attributes are not exposed as variables in this runtime (use the JS package or Arcweave's plugins).");
            return p;
        }

        private static IEnumerable<(string, JObject)> Entries(JToken t)
        {
            if (!(t is JObject o)) yield break;
            foreach (var prop in o.Properties()) if (prop.Value is JObject v) yield return (prop.Name, v);
        }
        private static IEnumerable<string> Strings(JToken t)
        {
            if (!(t is JArray a)) yield break;
            foreach (var x in a) if (x.Type == JTokenType.String) yield return (string)x;
        }

        /// <summary>Resolve an element by id or customId (prefix like "nel_" tolerated).</summary>
        public StoryGraphElement FindElement(string reference)
        {
            if (string.IsNullOrEmpty(reference)) return null;
            if (Elements.TryGetValue(reference, out var e)) return e;
            var stripped = Regex.Replace(reference, "^[a-z]{3}_", "");
            if (stripped != reference && Elements.TryGetValue(stripped, out e)) return e;
            return Elements.Values.FirstOrDefault(x => !string.IsNullOrEmpty(x.CustomId) && x.CustomId == reference);
        }
    }

    // ─────────────────────────────────────────────────────────────────── html

    public static class StoryGraphHtml
    {
        static readonly Regex CodeBlock = new Regex(@"<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)</code>\s*</pre>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        static readonly Regex Mention = new Regex(@"<span([^>]*)>([\s\S]*?)</span>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        static readonly Regex Tag = new Regex(@"<[^>]+>", RegexOptions.Compiled);
        static readonly Regex DataId = new Regex("data-id\\s*=\\s*\"([^\"]*)\"", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        static readonly Dictionary<string, string> Entities = new Dictionary<string, string>
        {
            {"amp","&"},{"lt","<"},{"gt",">"},{"quot","\""},{"apos","'"},{"nbsp"," "},
            {"aring","å"},{"Aring","Å"},{"aelig","æ"},{"AElig","Æ"},{"oslash","ø"},{"Oslash","Ø"},
            {"eacute","é"},{"egrave","è"},{"uuml","ü"},{"ouml","ö"},{"auml","ä"},{"ndash","–"},{"mdash","—"},{"hellip","…"},{"laquo","«"},{"raquo","»"},
        };

        public struct Segment { public bool IsCode; public string Text; }

        /// <summary>Element HTML → ordered prose/code segments (code: mentions → @[id], entities decoded).</summary>
        public static List<Segment> SplitSegments(string html)
        {
            var list = new List<Segment>();
            if (string.IsNullOrEmpty(html)) return list;
            int last = 0;
            foreach (Match m in CodeBlock.Matches(html))
            {
                if (m.Index > last) { var chunk = html.Substring(last, m.Index - last); if (chunk.Trim().Length > 0) list.Add(new Segment { IsCode = false, Text = chunk }); }
                list.Add(new Segment { IsCode = true, Text = PrepareCode(m.Groups[1].Value) });
                last = m.Index + m.Length;
            }
            if (last < html.Length) { var chunk = html.Substring(last); if (chunk.Trim().Length > 0) list.Add(new Segment { IsCode = false, Text = chunk }); }
            return list;
        }

        public static string StripCodeBlocks(string html) => string.IsNullOrEmpty(html) ? "" : CodeBlock.Replace(html, "");
        public static bool HasScript(string html) => !string.IsNullOrEmpty(html) && CodeBlock.IsMatch(html);

        static string PrepareCode(string inner)
        {
            var code = Mention.Replace(inner, m =>
            {
                var id = DataId.Match(m.Groups[1].Value);
                return id.Success && id.Groups[1].Value.Length > 0 ? "@[" + id.Groups[1].Value + "]" : DecodeEntities(Tag.Replace(m.Groups[2].Value, ""));
            });
            code = Regex.Replace(code, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
            code = Regex.Replace(code, @"</p>\s*<p[^>]*>", "\n", RegexOptions.IgnoreCase);
            return DecodeEntities(Tag.Replace(code, ""));
        }

        /// <summary>Mirror of the shared htmlToPlainText: paragraphs → newlines, tags stripped, entities decoded.</summary>
        public static string ToPlainText(string html)
        {
            if (string.IsNullOrEmpty(html)) return "";
            var t = Regex.Replace(html, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
            t = Regex.Replace(t, @"</(p|div|li|h[1-6]|blockquote|pre)>", "\n", RegexOptions.IgnoreCase);
            t = Regex.Replace(t, @"<li[^>]*>", "- ", RegexOptions.IgnoreCase);
            t = Tag.Replace(t, "");
            t = DecodeEntities(t).Replace('\u00a0', ' ');
            var lines = t.Split('\n').Select(l => Regex.Replace(l, "[ \t]+", " ").Trim());
            t = string.Join("\n", lines);
            t = Regex.Replace(t, "\n{3,}", "\n\n");
            return t.Trim();
        }

        public static string DecodeEntities(string s)
        {
            if (string.IsNullOrEmpty(s) || s.IndexOf('&') < 0) return s ?? "";
            return Regex.Replace(s, @"&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);", m =>
            {
                var name = m.Groups[1].Value;
                if (name.StartsWith("#x")) return char.ConvertFromUtf32(Convert.ToInt32(name.Substring(2), 16));
                if (name.StartsWith("#")) return char.ConvertFromUtf32(int.Parse(name.Substring(1), CultureInfo.InvariantCulture));
                return Entities.TryGetValue(name, out var v) ? v : m.Value;
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────── script (subset)

    /// <summary>Script values: bool, double or string. Ints are doubles with no fraction.</summary>
    public static class StoryGraphValue
    {
        public static bool Truthy(object v) => v is bool b ? b : v is double d ? d != 0 : v is string s ? s.Length > 0 : v != null;
        public static double Num(object v)
        {
            if (v is double d) return d;
            if (v is bool b) return b ? 1 : 0;
            if (v is string s && double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var r)) return r;
            return 0;
        }
        public static string Str(object v) => v is string s ? s : v is bool b ? (b ? "true" : "false") : v is double d ? Format(d) : "";
        public static string Format(double d) => Math.Abs(d - Math.Round(d)) < 1e-9 ? ((long)Math.Round(d)).ToString(CultureInfo.InvariantCulture) : (Math.Round(d * 1000) / 1000).ToString(CultureInfo.InvariantCulture);
        public static object Coerce(string type, object v)
        {
            switch (type)
            {
                case "boolean": case "bool": return Truthy(v);
                case "integer": case "int": return Math.Truncate(Num(v));
                case "float": return Num(v);
                default: return Str(v);
            }
        }
        public static object FromJson(object raw)
        {
            if (raw == null) return null;
            if (raw is bool || raw is string) return raw;
            if (raw is double || raw is float || raw is int || raw is long || raw is decimal) return Convert.ToDouble(raw, CultureInfo.InvariantCulture);
            return raw.ToString();
        }
        public static bool Equal(object a, object b)
        {
            if (a is bool || b is bool) return Truthy(a) == Truthy(b);
            if (a is string sa && b is string sb) return sa == sb;
            if (a is string || b is string)
            {
                var na = a is string s1 ? (double.TryParse(s1, NumberStyles.Float, CultureInfo.InvariantCulture, out var r1) ? r1 : double.NaN) : Num(a);
                var nb = b is string s2 ? (double.TryParse(s2, NumberStyles.Float, CultureInfo.InvariantCulture, out var r2) ? r2 : double.NaN) : Num(b);
                if (!double.IsNaN(na) && !double.IsNaN(nb)) return Math.Abs(na - nb) < 1e-9;
                return Str(a) == Str(b);
            }
            return Math.Abs(Num(a) - Num(b)) < 1e-9;
        }
    }

    internal sealed class ScriptContext
    {
        public readonly Dictionary<string, object> Variables = new Dictionary<string, object>();
        public readonly Dictionary<string, string> VariableTypes = new Dictionary<string, string>();
        public readonly Dictionary<string, int> Visits = new Dictionary<string, int>();
        public readonly Dictionary<string, string> VariableIdToName = new Dictionary<string, string>();
        public Func<string, string> ResolveElement;   // reference → element id (or null)
        public Func<double> Rng = () => 0.5;
        public string CurrentElementId;
        public readonly List<string> Warnings = new List<string>();

        public int VisitsOf(string elementId) => elementId != null && Visits.TryGetValue(elementId, out var n) ? n : 0;
    }

    internal sealed class MiniScript
    {
        enum T { Num, Str, Ident, Mention, Op, Kw, End }
        struct Tok { public T Type; public string Text; public double Num; }
        static readonly HashSet<string> Keywords = new HashSet<string> { "if", "elseif", "else", "endif", "is", "not", "and", "or", "true", "false" };

        readonly ScriptContext ctx;
        List<Tok> toks; int pos;
        public MiniScript(ScriptContext context) { ctx = context; }

        // ── tokenizer
        static List<Tok> Tokenize(string src)
        {
            var list = new List<Tok>();
            int i = 0;
            while (i < src.Length)
            {
                char c = src[i];
                if (char.IsWhiteSpace(c)) { i++; continue; }
                if (c == '@' && i + 1 < src.Length && src[i + 1] == '[')
                {
                    int close = src.IndexOf(']', i);
                    if (close < 0) throw new Exception("Unterminated @[ reference");
                    list.Add(new Tok { Type = T.Mention, Text = src.Substring(i + 2, close - i - 2).Trim() });
                    i = close + 1; continue;
                }
                if (char.IsDigit(c) || (c == '.' && i + 1 < src.Length && char.IsDigit(src[i + 1])))
                {
                    int s = i; while (i < src.Length && (char.IsDigit(src[i]) || src[i] == '.')) i++;
                    list.Add(new Tok { Type = T.Num, Num = double.Parse(src.Substring(s, i - s), CultureInfo.InvariantCulture) }); continue;
                }
                if (c == '\'' || c == '"')
                {
                    int s = ++i; var sb = new StringBuilder();
                    while (i < src.Length && src[i] != c) { if (src[i] == '\\' && i + 1 < src.Length) i++; sb.Append(src[i]); i++; }
                    i++; list.Add(new Tok { Type = T.Str, Text = sb.ToString() }); continue;
                }
                if (char.IsLetter(c) || c == '_' || c == '$')
                {
                    int s = i; while (i < src.Length && (char.IsLetterOrDigit(src[i]) || src[i] == '_' || src[i] == '$' || src[i] == '.')) i++;
                    var word = src.Substring(s, i - s).TrimStart('$');
                    list.Add(new Tok { Type = Keywords.Contains(word) ? T.Kw : T.Ident, Text = word }); continue;
                }
                string[] ops = { "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "&&", "||", "<", ">", "=", "+", "-", "*", "/", "%", "!", "(", ")", "," };
                var op = ops.FirstOrDefault(o => string.CompareOrdinal(src, i, o, 0, o.Length) == 0);
                if (op == null) throw new Exception("Unexpected character '" + c + "'");
                list.Add(new Tok { Type = T.Op, Text = op }); i += op.Length;
            }
            list.Add(new Tok { Type = T.End });
            return list;
        }

        Tok Peek => toks[pos];
        bool IsOp(string s) => Peek.Type == T.Op && Peek.Text == s;
        bool IsKw(string s) => Peek.Type == T.Kw && Peek.Text == s;
        Tok Next() => toks[pos++];
        void Expect(string op) { if (!IsOp(op)) throw new Exception("Expected '" + op + "'"); pos++; }

        // ── public API
        public bool EvaluateCondition(string script)
        {
            if (string.IsNullOrWhiteSpace(script)) return true;
            try { toks = Tokenize(script); pos = 0; var v = Or(); return StoryGraphValue.Truthy(v); }
            catch (Exception ex) { ctx.Warnings.Add("Condition error: " + ex.Message + " in '" + script + "'"); return false; }
        }

        /// <summary>Run an element/label HTML: executes code segments, returns the active prose HTML.</summary>
        public string RunHtml(string html)
        {
            var frames = new List<Frame>();
            var output = new StringBuilder();
            bool Active() => frames.Count == 0 || frames[frames.Count - 1].Active;
            foreach (var seg in StoryGraphHtml.SplitSegments(html))
            {
                if (!seg.IsCode) { if (Active()) output.Append(seg.Text); continue; }
                foreach (var raw in seg.Text.Split('\n'))
                {
                    var line = raw.Trim();
                    if (line.Length == 0 || line.StartsWith("//")) continue;
                    try
                    {
                        toks = Tokenize(line); pos = 0;
                        if (IsKw("if")) { pos++; bool parent = Active(); bool on = parent && StoryGraphValue.Truthy(Or()); frames.Add(new Frame { Parent = parent, Active = on, Taken = on }); }
                        else if (IsKw("elseif")) { pos++; if (frames.Count == 0) throw new Exception("elseif without if"); var f = frames[frames.Count - 1]; if (f.Taken) f.Active = false; else { f.Active = f.Parent && StoryGraphValue.Truthy(Or()); f.Taken |= f.Active; } frames[frames.Count - 1] = f; }
                        else if (IsKw("else")) { pos++; if (frames.Count == 0) throw new Exception("else without if"); var f = frames[frames.Count - 1]; f.Active = f.Parent && !f.Taken; f.Taken = true; frames[frames.Count - 1] = f; }
                        else if (IsKw("endif")) { pos++; if (frames.Count == 0) throw new Exception("endif without if"); frames.RemoveAt(frames.Count - 1); }
                        else if (Active()) Statement();
                    }
                    catch (Exception ex) { ctx.Warnings.Add("Script error: " + ex.Message + " in '" + line + "'"); }
                }
            }
            return output.ToString();
        }

        struct Frame { public bool Parent; public bool Active; public bool Taken; }

        void Statement()
        {
            if (Peek.Type == T.Ident && toks[pos + 1].Type == T.Op && (toks[pos + 1].Text == "=" || toks[pos + 1].Text.Length == 2 && toks[pos + 1].Text[1] == '=' && "+-*/%".IndexOf(toks[pos + 1].Text[0]) >= 0))
            {
                var name = Next().Text; var op = Next().Text; var rhs = Or();
                if (!ctx.Variables.ContainsKey(name)) throw new Exception("Unknown variable '" + name + "'");
                object cur = ctx.Variables[name], val;
                switch (op)
                {
                    case "=": val = rhs; break;
                    case "+=": val = (cur is string || rhs is string) ? (object)(StoryGraphValue.Str(cur) + StoryGraphValue.Str(rhs)) : StoryGraphValue.Num(cur) + StoryGraphValue.Num(rhs); break;
                    case "-=": val = StoryGraphValue.Num(cur) - StoryGraphValue.Num(rhs); break;
                    case "*=": val = StoryGraphValue.Num(cur) * StoryGraphValue.Num(rhs); break;
                    case "/=": { var d = StoryGraphValue.Num(rhs); if (d == 0) throw new Exception("Division by zero"); val = StoryGraphValue.Num(cur) / d; break; }
                    default: { var d = StoryGraphValue.Num(rhs); if (d == 0) throw new Exception("Modulo by zero"); val = StoryGraphValue.Num(cur) % d; break; }
                }
                ctx.Variables[name] = StoryGraphValue.Coerce(ctx.VariableTypes[name], val);
                return;
            }
            Or(); // expression statement (function call) — value discarded
        }

        // ── expression grammar (low → high): or, and, is/is not, == !=, < > <= >=, + -, * / %, unary, primary
        object Or() { var l = And(); while (IsKw("or") || IsOp("||")) { pos++; var r = And(); l = StoryGraphValue.Truthy(l) || StoryGraphValue.Truthy(r); } return l; }
        object And() { var l = Is(); while (IsKw("and") || IsOp("&&")) { pos++; var r = Is(); l = StoryGraphValue.Truthy(l) && StoryGraphValue.Truthy(r); } return l; }
        object Is()
        {
            var l = Equality();
            while (IsKw("is")) { pos++; bool neg = IsKw("not"); if (neg) pos++; var r = Equality(); l = StoryGraphValue.Equal(l, r) != neg; }
            return l;
        }
        object Equality()
        {
            var l = Relational();
            while (IsOp("==") || IsOp("!=")) { var op = Next().Text; var r = Relational(); l = StoryGraphValue.Equal(l, r) == (op == "=="); }
            return l;
        }
        object Relational()
        {
            var l = Additive();
            while (IsOp("<") || IsOp(">") || IsOp("<=") || IsOp(">="))
            {
                var op = Next().Text; double a = StoryGraphValue.Num(l), b = StoryGraphValue.Num(Additive());
                l = op == "<" ? a < b : op == ">" ? a > b : op == "<=" ? a <= b : a >= b;
            }
            return l;
        }
        object Additive()
        {
            var l = Multiplicative();
            while (IsOp("+") || IsOp("-"))
            {
                var op = Next().Text; var r = Multiplicative();
                if (op == "+") l = (l is string || r is string) ? (object)(StoryGraphValue.Str(l) + StoryGraphValue.Str(r)) : StoryGraphValue.Num(l) + StoryGraphValue.Num(r);
                else l = StoryGraphValue.Num(l) - StoryGraphValue.Num(r);
            }
            return l;
        }
        object Multiplicative()
        {
            var l = Unary();
            while (IsOp("*") || IsOp("/") || IsOp("%"))
            {
                var op = Next().Text; double a = StoryGraphValue.Num(l), b = StoryGraphValue.Num(Unary());
                if (op == "*") l = a * b;
                else { if (b == 0) throw new Exception(op == "/" ? "Division by zero" : "Modulo by zero"); l = op == "/" ? a / b : a % b; }
            }
            return l;
        }
        object Unary()
        {
            if (IsOp("!") || IsKw("not")) { pos++; return !StoryGraphValue.Truthy(Unary()); }
            if (IsOp("-")) { pos++; return -StoryGraphValue.Num(Unary()); }
            if (IsOp("+")) { pos++; return StoryGraphValue.Num(Unary()); }
            return Primary();
        }
        object Primary()
        {
            var t = Next();
            switch (t.Type)
            {
                case T.Num: return t.Num;
                case T.Str: return t.Text;
                case T.Mention:
                    if (ctx.VariableIdToName.TryGetValue(t.Text, out var vn) && ctx.Variables.TryGetValue(vn, out var vv)) return vv;
                    if (ctx.Variables.TryGetValue(t.Text, out var direct)) return direct;
                    return ctx.ResolveElement?.Invoke(t.Text) ?? t.Text;
                case T.Kw:
                    if (t.Text == "true") return true;
                    if (t.Text == "false") return false;
                    throw new Exception("Unexpected keyword '" + t.Text + "'");
                case T.Ident:
                    if (IsOp("(")) return Call(t.Text);
                    if (ctx.Variables.TryGetValue(t.Text, out var v)) return v;
                    throw new Exception("Unknown identifier '" + t.Text + "'");
                case T.Op when t.Text == "(": { var v2 = Or(); Expect(")"); return v2; }
                default: throw new Exception("Unexpected token");
            }
        }
        object Call(string name)
        {
            Expect("(");
            var values = new List<object>();
            var refs = new List<string>();
            while (!IsOp(")"))
            {
                if (Peek.Type == T.Mention) { var m = Next(); refs.Add(m.Text); values.Add(m.Text); }
                else if (Peek.Type == T.Ident && !(toks[pos + 1].Type == T.Op && toks[pos + 1].Text == "(") && !ctx.Variables.ContainsKey(Peek.Text)) { var m = Next(); refs.Add(m.Text); values.Add(m.Text); }
                else { var v = Or(); values.Add(v); refs.Add(v as string); }
                if (IsOp(",")) pos++; else break;
            }
            Expect(")");
            double N(int i) => i < values.Count ? StoryGraphValue.Num(values[i]) : 0;
            switch (name)
            {
                case "visits":
                    if (values.Count == 0) return (double)ctx.VisitsOf(ctx.CurrentElementId);
                    return (double)ctx.VisitsOf(ctx.ResolveElement?.Invoke(refs[0] ?? ""));
                case "abs": return Math.Abs(N(0));
                case "sqr": return N(0) * N(0);
                case "sqrt": if (N(0) < 0) throw new Exception("sqrt of negative"); return Math.Sqrt(N(0));
                case "round": return Math.Round(N(0), MidpointRounding.AwayFromZero);
                case "min": return values.Select((_, i) => N(i)).DefaultIfEmpty(0).Min();
                case "max": return values.Select((_, i) => N(i)).DefaultIfEmpty(0).Max();
                case "random": return ctx.Rng();
                case "roll":
                {
                    int sides = Math.Max(1, (int)Math.Floor(N(0))), count = values.Count > 1 ? Math.Max(1, (int)Math.Floor(N(1))) : 1; double sum = 0;
                    for (int i = 0; i < count; i++) sum += 1 + Math.Floor(ctx.Rng() * sides);
                    return sum;
                }
                case "show": case "reset": case "resetAll": case "resetVisits":
                    ctx.Warnings.Add("Unsupported function '" + name + "()' ignored (subset runtime).");
                    return 0.0;
                default: throw new Exception("Unknown function '" + name + "'");
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────── session

    public sealed class StoryGraphOption { public string ConnectionId; public string TargetId; public string LabelHtml; public string LabelText => StoryGraphHtml.ToPlainText(LabelHtml); }

    public sealed class StoryGraphView
    {
        public string ElementId;
        public StoryGraphElement Element;
        /// <summary>Rendered content HTML (conditional sections applied, code removed).</summary>
        public string Html;
        public string Text => StoryGraphHtml.ToPlainText(Html);
        public readonly List<StoryGraphOption> Options = new List<StoryGraphOption>();
        public bool DeadEnd;
        /// <summary>Name of the first attached component (speaker), or null.</summary>
        public string SpeakerName;
    }

    public sealed class StoryGraphSession
    {
        readonly StoryGraphProject project;
        readonly ScriptContext ctx = new ScriptContext();
        readonly MiniScript script;
        readonly int maxJumps;
        public StoryGraphView Current { get; private set; }
        public IReadOnlyList<string> Warnings => ctx.Warnings;
        public IReadOnlyDictionary<string, object> Variables => ctx.Variables;
        public IReadOnlyDictionary<string, int> Visits => ctx.Visits;

        public StoryGraphSession(StoryGraphProject project, Func<double> rng = null, int maxJumps = 100)
        {
            this.project = project;
            this.maxJumps = maxJumps;
            if (rng != null) ctx.Rng = rng;
            ctx.ResolveElement = r => project.FindElement(r)?.Id;
            script = new MiniScript(ctx);
            ResetState();
        }

        void ResetState()
        {
            ctx.Variables.Clear(); ctx.VariableTypes.Clear(); ctx.Visits.Clear(); ctx.VariableIdToName.Clear();
            foreach (var v in project.Variables)
            {
                ctx.VariableTypes[v.Name] = v.Type;
                ctx.Variables[v.Name] = StoryGraphValue.Coerce(v.Type, StoryGraphValue.FromJson(v.DefaultValue));
            }
            foreach (var v in project.Variables) ctx.VariableIdToName[v.Id] = v.Name;
        }

        public StoryGraphView Start()
        {
            ResetState();
            Current = null;
            var start = project.FindElement(project.StartingElement) ?? project.Elements.Values.FirstOrDefault();
            if (start == null) { ctx.Warnings.Add("No starting element."); return null; }
            return Enter(start.Id, 0);
        }

        public StoryGraphView Restart() => Start();

        public StoryGraphView Choose(string connectionId)
        {
            if (Current == null) return null;
            var opt = Current.Options.FirstOrDefault(o => o.ConnectionId == connectionId);
            if (opt == null || !project.Connections.TryGetValue(connectionId, out var conn)) return Current;
            if (StoryGraphHtml.HasScript(conn.LabelHtml)) script.RunHtml(conn.LabelHtml);
            return Enter(conn.TargetId, 0);
        }

        public object GetVariable(string name) => ctx.Variables.TryGetValue(name, out var v) ? v : null;
        public void SetVariable(string name, object value)
        {
            if (!ctx.VariableTypes.TryGetValue(name, out var type)) { ctx.Warnings.Add("Unknown variable '" + name + "'"); return; }
            ctx.Variables[name] = StoryGraphValue.Coerce(type, StoryGraphValue.FromJson(value));
        }
        public int VisitsOf(string reference) => ctx.VisitsOf(project.FindElement(reference)?.Id);

        StoryGraphView Enter(string id, int depth)
        {
            if (depth > maxJumps) { ctx.Warnings.Add("Stopped: more than " + maxJumps + " consecutive jumps (loop?)."); return Current = DeadEndView(id); }
            ctx.CurrentElementId = id;
            ctx.Visits[id] = ctx.VisitsOf(id) + 1;

            if (project.Jumpers.TryGetValue(id, out var jumper))
            {
                var target = project.FindElement(jumper.ElementId);
                if (target == null) return Current = DeadEndView(id);
                return Enter(target.Id, depth + 1);
            }
            if (project.Branches.TryGetValue(id, out var branch))
            {
                var order = new List<string>();
                if (branch.IfCondition != null) order.Add(branch.IfCondition);
                order.AddRange(branch.ElseIfConditions);
                if (branch.ElseCondition != null) order.Add(branch.ElseCondition);
                foreach (var cid in order)
                {
                    if (!project.Conditions.TryGetValue(cid, out var cond)) continue;
                    bool take = string.IsNullOrWhiteSpace(cond.Script) || script.EvaluateCondition(cond.Script);
                    if (!take) continue;
                    if (cond.Output != null && project.Connections.TryGetValue(cond.Output, out var next) && next.TargetId != null) return Enter(next.TargetId, depth + 1);
                    return Current = DeadEndView(id);
                }
                return Current = DeadEndView(id);
            }
            if (!project.Elements.TryGetValue(id, out var element)) { ctx.Warnings.Add("Element '" + id + "' does not exist."); return Current; }

            var view = new StoryGraphView { ElementId = id, Element = element, Html = script.RunHtml(element.ContentHtml) };
            foreach (var outId in element.Outputs)
            {
                if (!project.Connections.TryGetValue(outId, out var c) || c.TargetId == null) continue;
                if (!project.Elements.ContainsKey(c.TargetId) && !project.Branches.ContainsKey(c.TargetId) && !project.Jumpers.ContainsKey(c.TargetId)) continue;
                view.Options.Add(new StoryGraphOption { ConnectionId = c.Id, TargetId = c.TargetId, LabelHtml = StoryGraphHtml.StripCodeBlocks(c.LabelHtml) });
            }
            view.DeadEnd = view.Options.Count == 0;
            view.SpeakerName = element.Components.Select(cid => project.ComponentNames.TryGetValue(cid, out var n) ? n : null).FirstOrDefault(n => n != null);
            return Current = view;
        }

        StoryGraphView DeadEndView(string id)
        {
            project.Elements.TryGetValue(id, out var element);
            return new StoryGraphView { ElementId = id, Element = element ?? new StoryGraphElement { Id = id }, Html = "", DeadEnd = true };
        }
    }

    // ─────────────────────────────────────────────────────────────────── transcript (parity)

    public static class StoryGraphTranscript
    {
        /// <summary>Deterministic playthrough as text — same format as the JS package (`playTranscript`). Diff against fixtures/*.expected.txt.</summary>
        public static string Play(StoryGraphProject project, int maxSteps = 12, Func<int, int, int> pick = null)
        {
            var session = new StoryGraphSession(project, () => 0.5);
            var sb = new StringBuilder();
            var names = project.Variables.Select(v => v.Name).OrderBy(n => n, StringComparer.Ordinal).ToList();
            void Dump(StoryGraphView view)
            {
                if (view == null) { sb.Append("(no view)\n"); return; }
                sb.Append("@ ").Append(string.IsNullOrWhiteSpace(view.Element.CustomId) ? view.ElementId : view.Element.CustomId.Trim()).Append(" | ").Append(view.Element.TitleText.Trim()).Append('\n');
                var text = view.Text.Trim();
                if (text.Length > 0) sb.Append("  ").Append(string.Join(" / ", Regex.Split(text, @"\s*\n+\s*").Where(l => l.Length > 0))).Append('\n');
                for (int i = 0; i < view.Options.Count; i++) sb.Append("  ").Append(i + 1).Append(") ").Append(view.Options[i].LabelText.Trim()).Append('\n');
                if (view.DeadEnd) sb.Append("  (end)\n");
                sb.Append("  vars: ").Append(string.Join(" ", names.Select(n => n + "=" + FormatVar(session.GetVariable(n))))).Append('\n');
            }
            var v = session.Start();
            Dump(v);
            for (int step = 0; step < maxSteps && v != null && !v.DeadEnd && v.Options.Count > 0; step++)
            {
                int idx = pick == null ? 0 : Math.Min(Math.Max(pick(v.Options.Count, step), 0), v.Options.Count - 1);
                sb.Append("> choose ").Append(idx + 1).Append('\n');
                v = session.Choose(v.Options[idx].ConnectionId);
                Dump(v);
            }
            return sb.ToString();
        }

        static string FormatVar(object v) => v is bool b ? (b ? "true" : "false") : v is double d ? StoryGraphValue.Format(d) : "\"" + (v?.ToString() ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }
}
