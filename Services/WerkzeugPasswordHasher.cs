using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace TRG2._0_VNET.Services;


public sealed class WerkzeugPasswordHasher
{
    public string Hash(string password)
    {
        var salt = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var hash = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password),
            Encoding.UTF8.GetBytes(salt), 600_000, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2:sha256:600000${salt}${Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    public bool Verify(string password, string encoded)
    {
        var parts = encoded.Split('$');
        if (parts.Length != 3) return false;
        var method = parts[0].Split(':');
        if (method.Length != 3 || method[0] != "pbkdf2" || method[1] != "sha256"
            || !int.TryParse(method[2], NumberStyles.None, CultureInfo.InvariantCulture, out var iterations)
            || iterations <= 0 || iterations > 10_000_000 || parts[2].Length != 64) return false;
        try
        {
            var expected = Convert.FromHexString(parts[2]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password),
                Encoding.UTF8.GetBytes(parts[1]), iterations, HashAlgorithmName.SHA256, 32);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }
}
