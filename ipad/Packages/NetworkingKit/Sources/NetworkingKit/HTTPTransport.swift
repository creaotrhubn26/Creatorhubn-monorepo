import Foundation

/// Transportlaget appenes API-klienter deles om.
///
/// Bakgrunn: `CaptureApp` hadde to HTTP-klienter med hver sin halvdel av det
/// riktige. `BackendClient` mappet feil pent (401/403 → unauthorized, 404 →
/// notFound) men hadde verken timeout eller retry. `DashboardClient` hadde
/// timeout på 30 s og en gjennomtenkt retry-stige med jitter, men sin egen
/// feiltype. En tredje app ville arvet én av halvdelene, ikke begge.
///
/// Denne typen er begge halvdelene: auth-headere, feilmapping, timeout, og
/// retry som bare gjelder idempotente kall.
///
/// Den kjenner ingen endepunkter. API-flatene blir liggende i appene, der de
/// hører hjemme — dette er røret, ikke det som går gjennom det.
public actor HTTPTransport {
    private let baseURL: URL
    private let session: URLSession
    private let retryPolicy: RetryPolicy
    private let timeout: TimeInterval
    private var authHeaders: [String: String]

    /// - Parameters:
    ///   - timeout: Per forespørsel. URLSessions egen standard (60 s) er for
    ///     ettergivende for noe en bruker står og venter på.
    public init(
        baseURL: URL,
        session: URLSession = .shared,
        authHeaders: [String: String] = [:],
        retryPolicy: RetryPolicy = .default,
        timeout: TimeInterval = 30,
    ) {
        self.baseURL = baseURL
        self.session = session
        self.authHeaders = authHeaders
        self.retryPolicy = retryPolicy
        self.timeout = timeout
    }

    public func setAuthHeaders(_ headers: [String: String]) {
        authHeaders = headers
    }

    // MARK: - JSON

    public func get<Response: Decodable>(_ path: String) async throws -> Response {
        let data = try await send(makeRequest(path: path, method: "GET"))
        return try Self.decode(data)
    }

    public func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body,
    ) async throws -> Response {
        let data = try await send(try makeRequest(path: path, method: "POST", body: body))
        return try Self.decode(data)
    }

    /// POST der svaret ikke skal tolkes. Skilt fra `post` slik at kallstedet
    /// slipper å finne på en tom `Decodable` bare for å kaste den.
    public func postIgnoringResponse<Body: Encodable>(_ path: String, body: Body) async throws {
        _ = try await send(try makeRequest(path: path, method: "POST", body: body))
    }

    public func patchIgnoringResponse<Body: Encodable>(_ path: String, body: Body) async throws {
        _ = try await send(try makeRequest(path: path, method: "PATCH", body: body))
    }

    /// Rå forespørsel for kall som ikke er JSON inn/JSON ut — filopplasting,
    /// multipart, signerte S3-PUT-er.
    public func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else {
            throw HTTPError.transport("ikke HTTPURLResponse")
        }
        if http.statusCode == 401 || http.statusCode == 403 { throw HTTPError.unauthorized }
        if http.statusCode == 404 { throw HTTPError.notFound }
        guard (200..<300).contains(http.statusCode) else {
            throw HTTPError.httpStatus(http.statusCode, body: String(data: data, encoding: .utf8))
        }
        return data
    }

    /// Rå forespørsel som beholder responsen.
    ///
    /// Skilt fra ``send(_:)`` fordi noen kallsteder gjør sin egen
    /// statusbehandling — typisk opplastinger der 409 betyr «finnes
    /// allerede» og skal håndteres, ikke kastes. De arver fortsatt timeout og
    /// retry-stigen.
    public func rawData(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await perform(request)
    }

    /// Bygger en forespørsel med auth-headere og timeout satt.
    ///
    /// `URL(string:relativeTo:)` og ikke `appendingPathComponent`: stien kan
    /// bære en query-streng, og den siste ville prosentkodet «?» og ødelagt
    /// kallet.
    public func makeRequest(path: String, method: String) -> URLRequest {
        var request = URLRequest(url: URL(string: path, relativeTo: baseURL) ?? baseURL)
        request.httpMethod = method
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in authHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
        return request
    }

    private func makeRequest<Body: Encodable>(
        path: String, method: String, body: Body,
    ) throws -> URLRequest {
        var request = makeRequest(path: path, method: method)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            throw HTTPError.decode("kunne ikke kode forespørselen: \(error)")
        }
        return request
    }

    // MARK: - Retry

    /// Utfører kallet, med gjentakelser der det er forsvarlig.
    ///
    /// `maxAttempts` gjelder kun når metoden er idempotent. Det er hele
    /// poenget med stigen: en POST prøves aldri om igjen, uansett hvor
    /// forbigående feilen ser ut.
    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        let method = (request.httpMethod ?? "GET").uppercased()
        let idempotent = method == "GET" || method == "HEAD"
        let maxAttempts = idempotent ? retryPolicy.maxAttempts : 1

        var attempt = 0
        while true {
            attempt += 1
            do {
                let (data, response) = try await session.data(for: request)
                if attempt < maxAttempts,
                   let http = response as? HTTPURLResponse,
                   RetryPolicy.isRetryable(status: http.statusCode) {
                    try? await Task.sleep(for: .seconds(retryPolicy.delay(forAttempt: attempt)))
                    continue
                }
                return (data, response)
            } catch let urlError as URLError {
                if attempt < maxAttempts, RetryPolicy.isRetryable(urlError: urlError) {
                    try? await Task.sleep(for: .seconds(retryPolicy.delay(forAttempt: attempt)))
                    continue
                }
                throw HTTPError.transport(String(describing: urlError.code))
            }
        }
    }

    private static func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw HTTPError.decode(String(describing: error))
        }
    }
}
